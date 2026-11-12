use crate::model::*;
use anyhow::{Context, Result, ensure};
use std::{
    collections::{HashMap, HashSet},
    path::Path,
};
use unicode_normalization::UnicodeNormalization;

#[derive(Default)]
pub struct DayIndex {
    pub events: Vec<usize>,
    pub performances: Vec<usize>,
    pub plans: Vec<usize>,
    pub recordings: Vec<usize>,
    pub changes: Vec<usize>,
}
pub struct Archive {
    pub by_date: HashMap<chrono::NaiveDate, DayIndex>,
    pub data: Dataset,
    pub events: HashMap<String, usize>,
    pub works: HashMap<String, usize>,
    pub by_work: HashMap<String, Vec<usize>>,
    pub by_recording: HashMap<Bvid, Vec<usize>>,
    pub sorted_works: Vec<usize>,
    pub search: Vec<(Vec<String>, Vec<String>)>,
}
fn identities<'a>(keys: impl Iterator<Item = &'a str>) -> Result<HashMap<String, usize>> {
    let mut map = HashMap::new();
    for (index, key) in keys.enumerate() {
        ensure!(
            !key.is_empty() && key.trim() == key,
            "empty or padded identity"
        );
        ensure!(
            map.insert(key.to_owned(), index).is_none(),
            "duplicate identity {key}"
        );
    }
    Ok(map)
}
fn http_url(value: &str) -> Result<()> {
    let url = url::Url::parse(value).context("invalid URL")?;
    ensure!(
        matches!(url.scheme(), "http" | "https") && url.host_str().is_some(),
        "expected HTTP URL"
    );
    ensure!(
        url.username().is_empty() && url.password().is_none(),
        "credentials are forbidden in source URLs"
    );
    Ok(())
}
fn sources(values: &[Source]) -> Result<()> {
    let mut urls = HashSet::new();
    for source in values {
        http_url(&source.url)?;
        ensure!(urls.insert(&source.url), "duplicate source URL");
    }
    Ok(())
}
fn unique<T: Eq + std::hash::Hash>(values: &[T], label: &str) -> Result<()> {
    ensure!(
        values.iter().collect::<HashSet<_>>().len() == values.len(),
        "duplicate {label}"
    );
    Ok(())
}
fn assets(values: &[Asset]) -> Result<()> {
    for asset in values {
        match asset {
            Asset::Video { part_numbers, .. } => unique(part_numbers, "video part reference")?,
            Asset::Link { url, .. } => http_url(url)?,
        }
    }
    Ok(())
}

impl Archive {
    pub fn new(mut data: Dataset) -> Result<Self> {
        data.events
            .sort_by(|a, b| (a.date, &a.id).cmp(&(b.date, &b.id)));
        data.works.sort_by(|a, b| a.id.cmp(&b.id));
        data.performances
            .sort_by(|a, b| (a.date, &a.id).cmp(&(b.date, &b.id)));
        data.recordings.sort_by(|a, b| a.bvid.cmp(&b.bvid));
        data.plans
            .sort_by(|a, b| (a.date, &a.id).cmp(&(b.date, &b.id)));
        data.changes.sort_by(|a, b| a.id.cmp(&b.id));
        let events = identities(data.events.iter().map(|e| e.id.as_str()))?;
        let works = identities(data.works.iter().map(|e| e.id.as_str()))?;
        let changes = identities(data.changes.iter().map(|e| e.id.as_str()))?;
        identities(data.performances.iter().map(|e| e.id.as_str()))?;
        identities(data.recordings.iter().map(|e| e.bvid.as_str()))?;
        let plans = identities(data.plans.iter().map(|p| p.id.as_str()))?;
        let plan_entries = identities(
            data.plans
                .iter()
                .flat_map(|p| p.entries.iter().map(|e| e.id.as_str())),
        )?;
        let dates = data.plans.iter().map(|e| e.date).collect::<HashSet<_>>();
        ensure!(dates.len() == data.plans.len(), "duplicate plan date");
        let mut by_work: HashMap<String, Vec<usize>> = HashMap::new();
        let mut by_recording: HashMap<Bvid, Vec<usize>> = HashMap::new();
        for (i, event) in data.events.iter().enumerate() {
            (|| -> Result<()> {
                ensure!(!event.title.trim().is_empty(), "empty event title");
                for members in [
                    &event.recording_named_members,
                    &event.planned_members,
                    &event.credited_members,
                    &event.announced_members,
                    &event.absent_members,
                ] {
                    unique(members, "event member")?;
                }
                unique(&event.related_works, "related work")?;
                sources(&event.sources)?;
                assets(&event.assets)?;
                assets(&event.recordings)?;
                ensure!(
                    event.kind == EventKind::Announcement
                        || event.basis != EvidenceBasis::Announcement,
                    "an announcement alone cannot confirm an actual event"
                );
                if event.kind == EventKind::Livestream {
                    ensure!(
                        event.content_type.is_some() && event.dimension.is_some(),
                        "livestream classification is missing"
                    );
                } else {
                    ensure!(
                        event.content_type.is_none()
                            && event.dimension.is_none()
                            && event.is_unannounced.is_none(),
                        "non-livestream has livestream classification"
                    );
                }
                let recordings = event
                    .recordings
                    .iter()
                    .filter_map(Asset::bvid)
                    .collect::<HashSet<_>>();
                ensure!(
                    recordings.len() == event.recordings.len(),
                    "invalid or repeated recording reference"
                );
                if let Some(bvid) = &event.preferred_recording_bvid {
                    ensure!(
                        recordings.contains(bvid),
                        "preferred recording is not listed"
                    );
                }
                for stage in &event.stages {
                    ensure!(
                        stage.recording_bvids.iter().all(|b| recordings.contains(b)),
                        "stage recording is not listed"
                    );
                }
                for relation in &event.relations {
                    match &relation.target {
                        RecordReference::Event { id } => {
                            ensure!(events.contains_key(id), "missing event relation {id}")
                        }
                        RecordReference::PlanEntry { id } => ensure!(
                            plan_entries.contains_key(id),
                            "missing plan entry relation {id}"
                        ),
                    }
                }
                for id in &event.plan_ids {
                    ensure!(plans.contains_key(id), "missing plan {id}");
                }
                for claim in &event.recording_date_claims {
                    sources(&claim.sources)?;
                }
                for segment in &event.segments {
                    sources(&segment.sources)?;
                    assets(&segment.assets)?;
                    if let Some(id) = &segment.work_id {
                        ensure!(works.contains_key(id), "missing segment work {id}");
                    }
                }
                Ok(())
            })()
            .with_context(|| format!("event {}", event.id))?;
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
                event.title_hours.iter().all(|h| *h <= 23)
                    && event
                        .stages
                        .iter()
                        .all(|s| s.title_hours.iter().all(|h| *h <= 23)),
                "invalid title hour {}",
                event.id
            );
            for guest in &event.guests {
                http_url(&guest.url)
                    .with_context(|| format!("event {} has invalid guest URL", event.id))?;
            }
            for asset in &event.recordings {
                if let Some(bvid) = asset.bvid() {
                    by_recording.entry(bvid.clone()).or_default().push(i);
                }
            }
        }
        for (i, p) in data.performances.iter().enumerate() {
            (|| -> Result<()> {
                unique(&p.credited_members, "credited member")?;
                unique(&p.video_credited_members, "video credited member")?;
                let role_members = p.member_roles.iter().map(|r| r.member).collect::<Vec<_>>();
                unique(&role_members, "member role")?;
                ensure!(
                    role_members.iter().all(|m| p.credited_members.contains(m)),
                    "role member lacks performance credit"
                );
                sources(&p.sources)?;
                assets(&p.assets)?;
                Ok(())
            })()
            .with_context(|| format!("performance {}", p.id))?;
            let event = &data.events[*events.get(&p.event_id).with_context(|| {
                format!(
                    "performance {} references missing eventId {}",
                    p.id, p.event_id
                )
            })?];
            ensure!(
                works.contains_key(&p.work_id),
                "performance {} references missing workId {}",
                p.id,
                p.work_id
            );
            ensure!(
                event.kind != EventKind::Announcement,
                "performance linked to non-actual event {}",
                p.id
            );
            ensure!(
                event.contains_date(p.date),
                "performance date differs from event {}",
                p.id
            );
            by_work.entry(p.work_id.clone()).or_default().push(i);
        }
        for indexes in by_work.values_mut() {
            indexes.sort_by_key(|i| (data.performances[*i].date, &data.performances[*i].id));
        }
        for work in &data.works {
            ensure!(
                !work.title.trim().is_empty(),
                "work {} has empty title",
                work.id
            );
            sources(&work.sources).with_context(|| format!("work {}", work.id))?;
        }
        for plan in &data.plans {
            (|| -> Result<()> {
                sources(&plan.sources)?;
                ensure!(
                    plan.rest_day != Some(true) || plan.entries.is_empty(),
                    "rest day has planned entries"
                );
                for entry in &plan.entries {
                    sources(&entry.sources)?;
                    unique(&entry.arrangement.members, "planned member")?;
                    if let Some(count) = entry.arrangement.member_count {
                        ensure!(
                            usize::from(count.get()) >= entry.arrangement.members.len(),
                            "planned member count is too small"
                        );
                    }
                    for id in &entry.related_event_ids {
                        ensure!(events.contains_key(id), "missing related event {id}");
                    }
                }
                Ok(())
            })()
            .with_context(|| format!("plan {}", plan.id))?;
        }
        for recording in &data.recordings {
            (|| -> Result<()> {
                sources(&recording.sources)?;
                ensure!(!recording.title.trim().is_empty(), "empty recording title");
                ensure!(
                    recording.title_session.hour.is_none_or(|h| h <= 23),
                    "invalid title hour"
                );
                let parts = recording.parts.iter().map(|p| p.number).collect::<Vec<_>>();
                unique(&parts, "recording part number")?;
                Ok(())
            })()
            .with_context(|| format!("recording {}", recording.bvid))?;
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
            .map(|work| {
                (
                    std::iter::once(&work.title)
                        .chain(&work.aliases)
                        .map(|title| normalize(title))
                        .collect(),
                    work.original_artists
                        .iter()
                        .map(|name| normalize(name))
                        .collect(),
                )
            })
            .collect();
        let mut by_date: HashMap<chrono::NaiveDate, DayIndex> = HashMap::new();
        for (i, row) in data.events.iter().enumerate() {
            for date in row.dates() {
                by_date.entry(date).or_default().events.push(i);
            }
        }
        for (i, row) in data.performances.iter().enumerate() {
            by_date.entry(row.date).or_default().performances.push(i);
        }
        for (i, row) in data.plans.iter().enumerate() {
            by_date.entry(row.date).or_default().plans.push(i);
        }
        for (i, row) in data.recordings.iter().enumerate() {
            let dates = match by_recording.get(&row.bvid) {
                Some(events) => events
                    .iter()
                    .flat_map(|index| data.events[*index].dates())
                    .collect::<std::collections::BTreeSet<_>>(),
                None => std::collections::BTreeSet::from([row.title_session.date]),
            };
            for date in dates {
                by_date.entry(date).or_default().recordings.push(i);
            }
        }
        for (i, row) in data.changes.iter().enumerate() {
            row.validate()?;
            for id in &row.event_ids {
                ensure!(
                    events.contains_key(id),
                    "change {} references missing event {id}",
                    row.id
                );
            }
            for id in &row.announcement_event_ids {
                let event = events.get(id).with_context(|| {
                    format!("change {} references missing announcement {id}", row.id)
                })?;
                ensure!(
                    data.events[*event].kind == EventKind::Announcement,
                    "change {} references non-announcement {id}",
                    row.id
                );
            }
            for id in &row.replaces_change_ids {
                ensure!(
                    id != &row.id && changes.contains_key(id),
                    "change {} references invalid prior change {id}",
                    row.id
                );
            }
            for id in &row.plan_ids {
                ensure!(
                    plans.contains_key(id),
                    "change {} references missing plan {id}",
                    row.id
                );
            }
            for id in &row.plan_entry_ids {
                ensure!(
                    plan_entries.contains_key(id),
                    "change {} references missing plan entry {id}",
                    row.id
                );
            }
            sources(&row.sources).with_context(|| format!("change {}", row.id))?;
            for schedule in row.before.iter().chain(&row.after) {
                sources(&schedule.sources)
                    .with_context(|| format!("change {} arrangement", row.id))?;
            }
            for date in row.dates()? {
                by_date.entry(date).or_default().changes.push(i);
            }
        }
        for change in &data.changes {
            let mut pending = change.replaces_change_ids.iter().collect::<Vec<_>>();
            let mut visited = HashSet::new();
            while let Some(id) = pending.pop() {
                ensure!(
                    id != &change.id,
                    "change {} has a cyclic replacement relation",
                    change.id
                );
                if visited.insert(id) {
                    pending.extend(&data.changes[changes[id]].replaces_change_ids);
                }
            }
        }
        for day in by_date.values_mut() {
            day.events.sort_by_key(|i| &data.events[*i].id);
            day.changes.sort_by_key(|i| &data.changes[*i].id);
        }
        Ok(Self {
            by_date,
            data,
            events,
            works,
            by_work,
            by_recording,
            sorted_works,
            search,
        })
    }
    pub fn read(directory: &Path) -> Result<Self> {
        Self::new(Dataset::read(directory)?)
            .with_context(|| format!("invalid confirmed archive {}", directory.display()))
    }
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct EventsFile {
    events: Vec<Event>,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct WorksFile {
    works: Vec<Work>,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct PerformancesFile {
    performances: Vec<Performance>,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct RecordingsFile {
    recordings: Vec<Recording>,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct PlansFile {
    days: Vec<Plan>,
}
#[derive(serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct ChangesFile {
    changes: Vec<Change>,
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T> {
    let bytes = std::fs::read(path).with_context(|| format!("read {}", path.display()))?;
    let mut deserializer = serde_json::Deserializer::from_slice(&bytes);
    let data = serde_path_to_error::deserialize(&mut deserializer)
        .with_context(|| format!("invalid JSON {}", path.display()))?;
    deserializer
        .end()
        .with_context(|| format!("trailing data in {}", path.display()))?;
    Ok(data)
}
impl Dataset {
    pub fn read(directory: &Path) -> Result<Self> {
        let mut files = std::fs::read_dir(directory)?
            .map(|e| e.map(|e| e.path()))
            .collect::<std::io::Result<Vec<_>>>()?;
        files.sort();
        let mut data = Self::default();
        for path in files {
            let name = path
                .file_name()
                .and_then(|s| s.to_str())
                .with_context(|| format!("invalid input filename {}", path.display()))?;
            ensure!(
                path.is_file(),
                "unexpected input directory {}",
                path.display()
            );
            if name == "README.md" {
                continue;
            }
            if name == "songs.json" {
                data.works.extend(read_json::<WorksFile>(&path)?.works);
            } else if name == "plans.json" {
                data.plans.extend(read_json::<PlansFile>(&path)?.days);
            } else if file_period(name, "events-", 7) {
                data.events.extend(read_json::<EventsFile>(&path)?.events);
            } else if file_period(name, "performances-", 7) {
                data.performances
                    .extend(read_json::<PerformancesFile>(&path)?.performances);
            } else if file_period(name, "recordings-", 4) {
                data.recordings
                    .extend(read_json::<RecordingsFile>(&path)?.recordings);
            } else if file_period(name, "schedule-changes-", 7) {
                data.changes
                    .extend(read_json::<ChangesFile>(&path)?.changes);
            } else {
                anyhow::bail!("unrecognized archive input {}", path.display());
            }
        }
        ensure!(
            directory.join("songs.json").is_file() && directory.join("plans.json").is_file(),
            "missing songs.json or plans.json"
        );
        Ok(data)
    }
}

fn file_period(name: &str, prefix: &str, length: usize) -> bool {
    let Some(period) = name
        .strip_prefix(prefix)
        .and_then(|s| s.strip_suffix(".json"))
    else {
        return false;
    };
    if period.len() != length {
        return false;
    }
    let date = if length == 7 {
        format!("{period}-01")
    } else {
        format!("{period}-01-01")
    };
    chrono::NaiveDate::parse_from_str(&date, "%Y-%m-%d").is_ok_and(|parsed| {
        parsed
            .format(if length == 7 { "%Y-%m" } else { "%Y" })
            .to_string()
            == period
    })
}
pub fn normalize(value: &str) -> String {
    value
        .nfkc()
        .flat_map(char::to_lowercase)
        .filter(|c| c.is_alphanumeric())
        .collect()
}
