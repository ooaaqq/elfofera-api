use anyhow::{Context, Result};
use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use elfofera_api::{
    contract::Contract,
    data::{Archive, normalize},
    http::{App, router},
    model::Dataset,
    views::EventView,
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use std::path::Path;
use tower::ServiceExt;

fn confirmed() -> Result<Archive> {
    Archive::read(Path::new("data/calendar/confirmed"))
}
fn app(archive: Archive) -> Result<Router> {
    Ok(router(App {
        archive,
        contract: Contract::new()?,
    }))
}
async fn request(app: &Router, path: &str) -> Result<(StatusCode, Value, axum::http::HeaderMap)> {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(path).body(Body::empty())?)
        .await?;
    let status = response.status();
    let headers = response.headers().clone();
    let body = serde_json::from_slice(&response.into_body().collect().await?.to_bytes())?;
    Ok((status, body, headers))
}
#[tokio::test]
async fn boundary_rejects_invalid_dates_ranges_and_parameters() -> Result<()> {
    let app = app(Archive::new(Dataset::default())?)?;
    for query in [
        "from=2026-02-30&through=2026-03-01",
        "from=2026-01-01&through=2026-02-01",
        "from=2026-10-11&through=2026-10-10",
        "from=2026-10-11&through=2026-10-11&member=unknown",
        "from=2026-10-11&through=2026-10-11&include=events,wrong",
        "from=2026-10-11&through=2026-10-11&include=events,events",
    ] {
        assert_eq!(
            request(&app, &format!("/v1/timeline?{query}")).await?.0,
            StatusCode::BAD_REQUEST,
            "{query}"
        );
    }
    for query in [
        "q=!!!",
        "limit=101",
        "limit=0",
        "offset=-1",
        "limit=no",
        "include=history",
        "q=a&q=b",
    ] {
        assert_eq!(
            request(&app, &format!("/v1/works?{query}")).await?.0,
            StatusCode::BAD_REQUEST,
            "{query}"
        );
    }
    for suffix in [
        "statistics?from=2024-02-30",
        "history?from=2024-01-02&through=2024-01-01",
    ] {
        assert_eq!(
            request(&app, &format!("/v1/works/absent/{suffix}"))
                .await?
                .0,
            StatusCode::BAD_REQUEST
        );
    }
    assert_eq!(
        request(&app, "/v1/works/absent/history").await?.0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        request(&app, "/songs").await?.1,
        json!({"error":"not_found"})
    );
    let health = request(&app, "/health").await?;
    assert_eq!(health.1, json!({"service":"available"}));
    assert_eq!(health.2["cache-control"], "no-store");
    Ok(())
}
#[tokio::test]
async fn every_confirmed_month_satisfies_the_generated_response_contract() -> Result<()> {
    let archive = confirmed()?;
    let contract = Contract::new()?;
    let schema = &contract.definitions[0].response;
    let validator = jsonschema::options()
        .should_validate_formats(true)
        .build(schema)?;
    let app = app(archive)?;
    for year in 2022..=2026 {
        for month in 1..=12 {
            let from = chrono::NaiveDate::from_ymd_opt(year, month, 1).context("month start")?;
            let (next_year, next_month) = if month == 12 {
                (year + 1, 1)
            } else {
                (year, month + 1)
            };
            let through = chrono::NaiveDate::from_ymd_opt(next_year, next_month, 1)
                .and_then(|d| d.pred_opt())
                .context("month end")?;
            let (status,body,headers)=request(&app,&format!("/v1/timeline?from={from}&through={through}&include=events,plans,performances,recordings,changes")).await?;
            assert_eq!(status, StatusCode::OK);
            assert_eq!(headers["cache-control"], "public, max-age=60");
            validator
                .validate(&body)
                .map_err(|e| anyhow::anyhow!("{from}: {e}"))?;
            assert_eq!(
                body["days"].as_array().context("days")?.len(),
                (through - from).num_days() as usize + 1
            );
        }
    }
    Ok(())
}
#[tokio::test]
async fn timeline_preserves_debut_recordings_and_performances_without_events() -> Result<()> {
    let archive = confirmed()?;
    assert!(archive.by_recording["BV12W4y1q7JL"].len() > 1);
    let count = archive
        .data
        .performances
        .iter()
        .filter(|p| p.date.to_string() == "2022-07-24")
        .count();
    let app = app(archive)?;
    let (_,full,_)=request(&app,"/v1/timeline?from=2022-07-24&through=2022-07-24&include=events,plans,performances,recordings,changes").await?;
    for category in ["events", "plans", "recordings"] {
        assert!(
            !full["days"][0][category]
                .as_array()
                .context("category")?
                .is_empty()
        );
    }
    assert!(
        full["days"][0]["events"]
            .as_array()
            .context("events")?
            .iter()
            .any(|e| e["performances"].as_array().is_some_and(|p| !p.is_empty()))
    );
    let (_, without, _) = request(
        &app,
        "/v1/timeline?from=2022-07-24&through=2022-07-24&include=performances",
    )
    .await?;
    assert_eq!(without["days"][0]["events"], json!([]));
    assert_eq!(
        without["days"][0]["performances"]
            .as_array()
            .context("performances")?
            .len(),
        count
    );
    let text = full.to_string();
    assert!(text.contains("https://www.bilibili.com/video/"));
    assert!(!text.contains("../evidence/"));
    assert!(!text.contains("\"data\":"));
    Ok(())
}
#[tokio::test]
async fn search_normalizes_unicode_and_history_paginates_with_matching_statistics() -> Result<()> {
    let archive = confirmed()?;
    let (id, _) = archive
        .by_work
        .iter()
        .find(|(_, items)| items.len() > 2)
        .context("history fixture")?;
    let id = id.clone();
    let app = app(archive)?;
    let queries = ["Lemon", "Ｌｅｍｏｎ", "L e m o n"];
    let mut previous = None;
    for q in queries {
        let encoded = url::form_urlencoded::Serializer::new(String::new())
            .append_pair("q", q)
            .finish();
        let (status, body, _) = request(&app, &format!("/v1/works?{encoded}")).await?;
        assert_eq!(status, StatusCode::OK);
        assert!(!body["items"].as_array().context("works")?.is_empty());
        if let Some(previous) = &previous {
            assert_eq!(previous, &body);
        }
        previous = Some(body);
    }
    let (_, first, _) = request(&app, &format!("/v1/works/{id}/history?limit=1")).await?;
    let (_, second, _) = request(&app, &format!("/v1/works/{id}/history?limit=1&offset=1")).await?;
    assert_ne!(first["items"][0]["id"], second["items"][0]["id"]);
    assert_eq!(first["total"], second["total"]);
    assert_eq!(first["hasMore"], true);
    let (_, stats, _) = request(&app, &format!("/v1/works/{id}/statistics")).await?;
    assert_eq!(stats["total"], first["total"]);
    for entry in stats["byMember"].as_array().context("counts")? {
        let member = entry["member"].as_str().context("member")?;
        let (_, history, _) = request(
            &app,
            &format!("/v1/works/{id}/history?member={member}&limit=1"),
        )
        .await?;
        assert_eq!(entry["count"], history["total"]);
    }
    Ok(())
}
#[test]
fn source_boundary_rejects_corruption_before_serving() -> Result<()> {
    let source = confirmed()?.snapshot;
    let mut duplicate = source.clone();
    let event = duplicate["events"][0].clone();
    duplicate["events"]
        .as_array_mut()
        .context("events")?
        .push(event);
    assert!(Archive::from_value(duplicate).is_err());
    for (field, value) in [
        ("workId", "missing"),
        ("eventId", "missing"),
        ("date", "2026-02-30"),
    ] {
        let mut broken = source.clone();
        broken["performances"][0][field] = json!(value);
        assert!(Archive::from_value(broken).is_err(), "{field}");
    }
    let mut wrong = source.clone();
    wrong["events"][0]["recordingNamedMembers"] = json!(["unknown"]);
    assert!(Archive::from_value(wrong).is_err());
    let mut non_actual = source.clone();
    let event_id = non_actual["performances"][0]["eventId"].clone();
    let event = non_actual["events"]
        .as_array_mut()
        .context("events")?
        .iter_mut()
        .find(|e| e["id"] == event_id)
        .context("linked event")?;
    event["occurrence"] = json!("cancelled");
    assert!(Archive::from_value(non_actual).is_err());
    Ok(())
}
#[tokio::test]
async fn duet_is_one_performance_and_group_credit_never_invents_members() -> Result<()> {
    let archive = Archive::from_value(
        json!({"events":[{"id":"event","date":"2026-10-26","title":"Show","kind":"livestream","occurrence":"source-attested","hostMember":"youen"}],"works":[{"id":"work","title":"Song"}],"performances":[
        {"id":"duet","date":"2026-10-26","eventId":"event","workId":"work","type":"singing","creditedMembers":["luzao","luzao","youen"],"assets":[]},
        {"id":"group","date":"2026-10-26","eventId":"event","workId":"work","type":"singing","creditedGroup":"EOE","assets":[]}],"recordings":[],"plans":[],"changes":[]}),
    )?;
    let view = EventView::from(&archive.data.events[0]);
    assert!(view.recording_named_members.is_empty());
    assert!(view.planned_members.is_empty());
    let app = app(archive)?;
    let (_, stats, _) = request(&app, "/v1/works/work/statistics").await?;
    assert_eq!(stats["total"], 2);
    assert_eq!(stats["uncredited"], 1);
    assert_eq!(
        stats["byMember"]
            .as_array()
            .context("members")?
            .iter()
            .map(|e| e["count"].clone())
            .collect::<Vec<_>>(),
        vec![json!(1), json!(1), json!(0), json!(0), json!(0)]
    );
    // The broadcast host is not proof of performance attribution.
    let (_, timeline, _) = request(
        &app,
        "/v1/timeline?from=2026-10-26&through=2026-10-26&member=minuo&include=events,performances",
    )
    .await?;
    assert_eq!(timeline["days"][0]["events"], json!([]));
    assert_eq!(timeline["days"][0]["performances"], json!([]));
    Ok(())
}
#[test]
fn tools_and_http_share_one_schema_and_allow_explicit_null_optionals() -> Result<()> {
    let contract = Contract::new()?;
    assert_eq!(contract.tools.as_array().context("tools")?.len(), 4);
    for tool in contract.tools.as_array().context("tools")? {
        let schema = &tool["parameters"];
        let validator = jsonschema::options()
            .should_validate_formats(true)
            .build(schema)?;
        assert_eq!(
            schema["properties"]
                .as_object()
                .context("properties")?
                .len(),
            schema["required"].as_array().context("required")?.len()
        );
        assert_eq!(schema["additionalProperties"], false);
        if tool["name"] == "elfofera_search_works" {
            assert!(
                validator.is_valid(&json!({"q":"Lemon","artist":null,"limit":null,"offset":null}))
            );
            assert!(!validator.is_valid(&json!({"q":"Lemon"})));
        }
        if tool["name"] == "elfofera_timeline" {
            assert!(!validator.is_valid(
                &json!({"from":"2026-02-30","through":"2026-03-01","member":null,"include":null})
            ));
        }
    }
    assert_eq!(normalize("Ｌｅｍｏｎ !!"), "lemon");
    Ok(())
}
