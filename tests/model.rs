use anyhow::{Context, Result};
use elfofera_api::{data::Archive, model::Dataset};
use serde_json::{Value, json};
use std::path::Path;

fn fixture() -> Result<Value> {
    Ok(serde_json::to_value(
        Archive::read(Path::new("data/calendar/confirmed"))?.data,
    )?)
}
fn accepts(value: Value) -> bool {
    serde_json::from_value::<Dataset>(value)
        .ok()
        .is_some_and(|d| Archive::new(d).is_ok())
}
#[test]
fn rejects_unknown_fields_in_every_business_domain() -> Result<()> {
    let source = fixture()?;
    for category in [
        "events",
        "works",
        "performances",
        "recordings",
        "plans",
        "changes",
    ] {
        let mut bad = source.clone();
        bad[category][0]["unrecognizedBusinessField"] = json!(true);
        assert!(!accepts(bad), "{category}");
    }
    let index = source["plans"]
        .as_array()
        .context("plans")?
        .iter()
        .position(|plan| {
            plan["entries"]
                .as_array()
                .is_some_and(|entries| !entries.is_empty())
        })
        .context("populated plan")?;
    let mut bad = source;
    bad["plans"][index]["entries"][0]["arrangement"]["member"] = json!("youen");
    assert!(!accepts(bad));
    Ok(())
}
#[test]
fn checks_member_roles_video_identities_source_urls_and_all_reference_kinds() -> Result<()> {
    let source = fixture()?;
    for (category, field, value) in [
        ("events", "basis", json!("scheduled")),
        ("events", "planIds", json!(["missing"])),
        (
            "events",
            "relations",
            json!([{"kind":"related","target":{"kind":"event","id":"missing"}}]),
        ),
        (
            "events",
            "relations",
            json!([{"kind":"related","target":{"kind":"plan-entry","id":"missing"}}]),
        ),
        ("events", "preferredRecordingBvid", json!("BV0000000000")),
        ("performances", "creditedMembers", json!(["youen", "youen"])),
        (
            "performances",
            "memberRoles",
            json!([{"member":"unknown","role":"singing"}]),
        ),
        ("recordings", "bvid", json!("BVbad")),
        (
            "recordings",
            "titleSession",
            json!({"date":"2024-01-01","hour":24}),
        ),
        ("works", "sources", json!([{"url":"file:///private/data"}])),
        (
            "works",
            "sources",
            json!([{"url":"https://user:password@example.com"}]),
        ),
    ] {
        let mut bad = source.clone();
        bad[category][0][field] = value;
        assert!(!accepts(bad), "{category}.{field}");
    }
    let mut bad = source;
    bad["changes"][0]["planEntryIds"] = json!(["missing"]);
    assert!(!accepts(bad));
    Ok(())
}
#[test]
fn normalized_snapshots_preserve_all_typed_facts_without_a_raw_copy() -> Result<()> {
    let first = Archive::read(Path::new("data/calendar/confirmed"))?;
    let bytes = serde_json::to_vec(&first.data)?;
    let restored = Archive::new(serde_json::from_slice(&bytes)?)?;
    assert_eq!(bytes, serde_json::to_vec(&restored.data)?);
    let mut data = restored.data;
    data.events.reverse();
    data.works.reverse();
    data.performances.reverse();
    data.recordings.reverse();
    data.plans.reverse();
    data.changes.reverse();
    assert_eq!(bytes, serde_json::to_vec(&Archive::new(data)?.data)?);
    let value: Value = serde_json::from_slice(&bytes)?;
    assert!(
        value["events"]
            .as_array()
            .context("events")?
            .iter()
            .all(|e| e.get("evidence").is_none() && e.get("occurrence").is_none())
    );
    assert!(!String::from_utf8(bytes)?.contains("../evidence/"));
    Ok(())
}
