use anyhow::{Context, Result};
use elfofera_api::{
    contract::{Contract, TimelineQuery},
    data::Archive,
    model::{Dataset, Member},
};
use serde_json::{Value, json};
use std::{collections::HashSet, path::Path};

fn change(id: &str, impact: Value) -> Value {
    json!({
        "id": id, "action":"absence", "impact":impact, "members":["youen"],
        "before":[], "after":[], "eventIds":[], "announcementEventIds":[],
        "relatedPlanDates":[], "notes":[], "sources":[]
    })
}
fn fixture(changes: Vec<Value>) -> Result<Archive> {
    let mut data = serde_json::to_value(Dataset::default())?;
    data["changes"] = json!(changes);
    Archive::from_value(data)
}
fn query(archive: &Archive, from: &str, through: &str, member: Option<Member>) -> Result<Value> {
    Ok(serde_json::to_value(archive.timeline(TimelineQuery {
        from: from.parse()?,
        through: through.parse()?,
        member,
        include: "changes".into(),
    }))?)
}

#[test]
fn ranges_and_unknown_endings_have_explicit_time_semantics() -> Result<()> {
    let range = change(
        "range",
        json!({"kind":"range","from":"2024-01-01","through":"2024-01-03"}),
    );
    let ongoing = change("ongoing", json!({"kind":"ongoing","from":"2024-01-02"}));
    let mut undated = change("undated", json!({"kind":"undated"}));
    undated["announcedOn"] = json!("2024-01-03");
    let archive = fixture(vec![range, ongoing, undated])?;
    let body = query(&archive, "2024-01-01", "2024-01-04", None)?;
    let ids = |day: usize| -> Result<HashSet<&str>> {
        body["days"][day]["changes"]
            .as_array()
            .context("changes")?
            .iter()
            .map(|c| c["id"].as_str().context("change id"))
            .collect()
    };
    assert_eq!(ids(0)?, HashSet::from(["range"]));
    assert_eq!(ids(1)?, HashSet::from(["range", "ongoing"]));
    assert_eq!(ids(2)?, HashSet::from(["range", "undated"]));
    assert!(ids(3)?.is_empty());
    assert!(
        query(&archive, "2024-01-01", "2024-01-04", Some(Member::Luzao))?["days"]
            .as_array()
            .context("days")?
            .iter()
            .all(|d| d["changes"] == json!([]))
    );
    Ok(())
}

#[test]
fn rejects_ambiguous_dates_unknown_members_and_legacy_fields() -> Result<()> {
    for impact in [
        json!({"kind":"dates","dates":[]}),
        json!({"kind":"dates","dates":["2024-01-01","2024-01-01"]}),
        json!({"kind":"range","from":"2024-01-03","through":"2024-01-01"}),
        json!({"kind":"undated"}),
    ] {
        assert!(fixture(vec![change("bad", impact)]).is_err());
    }
    for (field, value) in [
        ("member", json!("youen")),
        ("members", json!(["unknown"])),
        ("eventIds", json!(["missing"])),
        ("announcementEventIds", json!(["missing"])),
        ("replacesChangeIds", json!(["missing"])),
        ("relatedPlanDates", json!(["2024-01-01"])),
        ("action", json!("cancel")),
    ] {
        let mut c = change("bad", json!({"kind":"dates","dates":["2024-01-01"]}));
        c[field] = value;
        assert!(fixture(vec![c]).is_err(), "accepted {field}");
    }
    Ok(())
}

#[test]
fn stable_ids_and_order_do_not_depend_on_input_order() -> Result<()> {
    let a = change(
        "a",
        json!({"kind":"dates","dates":["2024-01-01","2024-01-02"]}),
    );
    let b = change("b", json!({"kind":"dates","dates":["2024-01-01"]}));
    let first = fixture(vec![a.clone(), b.clone()])?;
    let second = fixture(vec![b.clone(), a.clone()])?;
    assert_eq!(
        query(&first, "2024-01-01", "2024-01-02", None)?,
        query(&second, "2024-01-01", "2024-01-02", None)?
    );
    assert!(fixture(vec![a.clone(), a]).is_err());
    Ok(())
}

#[test]
fn every_confirmed_change_is_reachable_with_its_identity_and_links() -> Result<()> {
    let archive = Archive::read(Path::new("data/calendar/confirmed"))?;
    for c in &archive.data.changes {
        for date in c.dates()? {
            let body = query(&archive, &date.to_string(), &date.to_string(), None)?;
            let found = body["days"][0]["changes"]
                .as_array()
                .context("changes")?
                .iter()
                .find(|v| v["id"] == c.id)
                .with_context(|| format!("{} missing on {date}", c.id))?;
            assert_eq!(found["eventIds"], json!(c.event_ids));
            assert_eq!(
                found["announcementEventIds"],
                json!(c.announcement_event_ids)
            );
            for member in &c.members {
                let body = query(
                    &archive,
                    &date.to_string(),
                    &date.to_string(),
                    Some(*member),
                )?;
                assert!(
                    body["days"][0]["changes"]
                        .as_array()
                        .context("filtered changes")?
                        .iter()
                        .any(|v| v["id"] == c.id)
                );
            }
        }
    }
    let contract = Contract::new()?;
    let validator = jsonschema::validator_for(&contract.definitions[0].response)?;
    let mut body = query(&archive, "2023-05-25", "2023-05-26", None)?;
    assert!(validator.is_valid(&body));
    body["days"][1]["changes"][0]["title"] = json!(42);
    assert!(
        !validator.is_valid(&body),
        "contract must validate a property named title"
    );
    Ok(())
}
