use crate::model::*;
use anyhow::{Context, Result, ensure};
use serde_json::Value;
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};
use unicode_categories::UnicodeCategories;
use unicode_normalization::UnicodeNormalization;

pub struct Archive {
    pub snapshot: Value,
    pub data: Dataset,
    pub events: HashMap<String, usize>,
    pub works: HashMap<String, usize>,
    pub by_work: HashMap<String, Vec<usize>>,
    pub by_event: HashMap<String, Vec<usize>>,
    pub by_recording: HashMap<String, Vec<usize>>,
    pub sorted_works: Vec<usize>,
    pub search: Vec<(String, String)>,
}
fn identities<'a>(keys: impl Iterator<Item = &'a str>) -> Result<HashMap<String, usize>> {
    let mut map = HashMap::new();
    for (index, key) in keys.enumerate() {
        ensure!(!key.is_empty(), "empty identity");
        ensure!(
            map.insert(key.to_owned(), index).is_none(),
            "duplicate identity {key}"
        );
    }
    Ok(map)
}
impl Archive {
    pub fn new(mut data: Dataset) -> Result<Self> {
        for row in &mut data.events {
            row.source_urls = crate::views::source_urls(row)?;
        }
        for row in &mut data.works {
            row.source_urls = crate::views::source_urls(row)?;
        }
        for row in &mut data.performances {
            row.source_urls = crate::views::source_urls(row)?;
        }
        for row in &mut data.plans {
            row.source_urls = crate::views::source_urls(row)?;
        }
        for row in &mut data.changes {
            row.source_urls = crate::views::source_urls(row)?;
        }
        let events = identities(data.events.iter().map(|e| e.id.as_str()))?;
        let works = identities(data.works.iter().map(|e| e.id.as_str()))?;
        identities(data.performances.iter().map(|e| e.id.as_str()))?;
        identities(data.recordings.iter().map(|e| e.bvid.as_str()))?;
        let dates = data.plans.iter().map(|e| e.date).collect::<HashSet<_>>();
        ensure!(dates.len() == data.plans.len(), "duplicate plan date");
        let mut by_work: HashMap<String, Vec<usize>> = HashMap::new();
        let mut by_event: HashMap<String, Vec<usize>> = HashMap::new();
        let mut by_recording: HashMap<String, Vec<usize>> = HashMap::new();
        for (i, event) in data.events.iter().enumerate() {
            ensure!(
                event.end_date.is_none_or(|d| d >= event.date),
                "reversed event dates {}",
                event.id
            );
            ensure!(
                event.related_works.iter().all(|w| works.contains_key(w)),
                "missing related work {}",
                event.id
            );
            ensure!(
                event
                    .stages
                    .iter()
                    .all(|s| s.title_hours.iter().all(|h| *h <= 23)),
                "invalid title hour {}",
                event.id
            );
            for guest in &event.guests {
                url::Url::parse(&guest.url).context("invalid guest URL")?;
            }
            for asset in &event.recordings {
                if let Some(bvid) = &asset.bvid {
                    by_recording.entry(bvid.clone()).or_default().push(i);
                }
            }
        }
        for (i, p) in data.performances.iter().enumerate() {
            let event = &data.events[*events
                .get(&p.event_id)
                .context("unlinked performance event")?];
            ensure!(
                works.contains_key(&p.work_id),
                "unlinked performance work {}",
                p.id
            );
            ensure!(
                !matches!(
                    event.occurrence.as_str(),
                    "cancelled" | "scheduled" | "announced"
                ),
                "performance linked to non-actual event {}",
                p.id
            );
            ensure!(
                event.date == p.date,
                "performance date differs from event {}",
                p.id
            );
            by_work.entry(p.work_id.clone()).or_default().push(i);
            by_event.entry(p.event_id.clone()).or_default().push(i);
        }
        for indexes in by_work.values_mut() {
            indexes.sort_by_key(|i| (data.performances[*i].date, &data.performances[*i].id));
        }
        let collator = icu_collator::Collator::try_new(
            icu_locale::locale!("zh-CN").into(),
            Default::default(),
        )
        .context("Chinese collation data")?;
        let mut sorted_works = (0..data.works.len()).collect::<Vec<_>>();
        sorted_works.sort_by(|a, b| {
            collator
                .compare(&data.works[*a].title, &data.works[*b].title)
                .then_with(|| data.works[*a].id.cmp(&data.works[*b].id))
        });
        let search = data
            .works
            .iter()
            .map(|w| {
                (
                    normalize(&w.title),
                    normalize(&w.original_artists.join(" ")),
                )
            })
            .collect();
        Ok(Self {
            snapshot: serde_json::to_value(&data)?,
            data,
            events,
            works,
            by_work,
            by_event,
            by_recording,
            sorted_works,
            search,
        })
    }
    pub fn from_value(value: Value) -> Result<Self> {
        let schema = schemars::schema_for!(Dataset);
        jsonschema::options()
            .should_validate_formats(true)
            .build(schema.as_value())?
            .validate(&value)
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;
        let mut archive = Self::new(serde_json::from_value(value.clone())?)?;
        archive.snapshot = value;
        Ok(archive)
    }
    pub fn read(directory: &Path) -> Result<Self> {
        let mut files = std::fs::read_dir(directory)?
            .map(|e| e.map(|e| e.path()))
            .collect::<std::io::Result<Vec<_>>>()?;
        files.sort();
        let mut data = serde_json::json!({"events":[],"works":[],"performances":[],"recordings":[],"plans":[],"changes":[]});
        for path in files {
            let Some(name) = path.file_name().and_then(|s| s.to_str()) else {
                continue;
            };
            let category = if name == "songs.json" {
                Some(("works", "works"))
            } else if name == "plans.json" {
                Some(("plans", "days"))
            } else if file_period(name, "events-", 7) {
                Some(("events", "events"))
            } else if file_period(name, "performances-", 7) {
                Some(("performances", "performances"))
            } else if file_period(name, "recordings-", 4) {
                Some(("recordings", "recordings"))
            } else if file_period(name, "schedule-changes-", 7) {
                Some(("changes", "changes"))
            } else {
                None
            };
            if let Some((target, key)) = category {
                let value: Value = serde_json::from_slice(&std::fs::read(&path)?)?;
                let rows = value[key]
                    .as_array()
                    .with_context(|| format!("{} missing {key}", path.display()))?;
                data[target]
                    .as_array_mut()
                    .context("dataset array")?
                    .extend(rows.iter().cloned());
            }
        }
        ensure!(
            directory.join("songs.json").is_file() && directory.join("plans.json").is_file(),
            "missing songs.json or plans.json"
        );
        Self::from_value(data)
    }
}
fn file_period(name: &str, prefix: &str, length: usize) -> bool {
    name.strip_prefix(prefix)
        .and_then(|s| s.strip_suffix(".json"))
        .is_some_and(|s| {
            s.len() == length
                && s.bytes()
                    .enumerate()
                    .all(|(i, b)| b.is_ascii_digit() || (length == 7 && i == 4 && b == b'-'))
        })
}
pub fn normalize(value: &str) -> String {
    value
        .nfkc()
        .flat_map(char::to_lowercase)
        .filter(|c| !c.is_punctuation() && !c.is_symbol() && !c.is_whitespace())
        .collect()
}
