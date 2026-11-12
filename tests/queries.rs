use anyhow::Result;
use elfofera_api::{
    contract::{SearchQuery, TimelineQuery},
    data::Archive,
    model::{Dataset, Member},
};
use serde_json::{Value, json};
fn fixture() -> Result<Archive> {
    let data: Dataset = serde_json::from_value(json!({
        "events":[{"id":"event","date":"2024-01-01","endDate":"2024-01-02","title":"Overnight show","kind":"livestream","basis":"recording","contentType":"mixed","dimension":"2d","creditedMembers":["luzao"],"recordings":[{"kind":"video","bvid":"BV0000000001"}]}],
        "works":[{"id":"work","title":"AB","aliases":["CD"],"originalArtists":["EF","GH"]}],
        "performances":[{"id":"performance","date":"2024-01-02","eventId":"event","workId":"work","type":"singing","creditedMembers":["luzao"],"assets":[]}],
        "recordings":[{"bvid":"BV0000000001","title":"Incorrectly dated title","titleSession":{"date":"2024-01-03"},"uploader":{}},{"bvid":"BV0000000002","title":"Unlinked recording","titleSession":{"date":"2024-01-04"},"uploader":{}}],
        "plans":[],"changes":[]
    }))?;
    Archive::new(data)
}
fn timeline(a: &Archive, from: &str, through: &str, member: Option<Member>) -> Result<Value> {
    Ok(serde_json::to_value(a.timeline(TimelineQuery {
        from: from.parse()?,
        through: through.parse()?,
        member,
        include: "events,performances,recordings".into(),
    }))?)
}
#[test]
fn overnight_events_and_verified_performance_dates_share_one_identity() -> Result<()> {
    let a = fixture()?;
    let body = timeline(&a, "2024-01-01", "2024-01-02", Some(Member::Luzao))?;
    assert_eq!(body["days"][0]["events"][0]["id"], "event");
    assert_eq!(body["days"][1]["events"][0]["id"], "event");
    assert_eq!(body["days"][0]["events"][0]["performances"], json!([]));
    assert_eq!(
        body["days"][1]["events"][0]["performances"][0]["id"],
        "performance"
    );
    assert_eq!(
        body["days"][1]["events"][0]["creditedMembers"],
        json!(["luzao"])
    );
    let stats = a
        .statistics(
            "work",
            elfofera_api::contract::StatisticsQuery {
                from: None,
                through: None,
            },
        )
        .ok_or_else(|| anyhow::anyhow!("statistics"))?;
    assert_eq!(stats.total, 1);
    Ok(())
}
#[test]
fn recording_titles_never_override_linked_event_dates_or_member_filters() -> Result<()> {
    let a = fixture()?;
    let body = timeline(&a, "2024-01-01", "2024-01-04", Some(Member::Luzao))?;
    for day in [0, 1] {
        let r = &body["days"][day]["recordings"][0];
        assert_eq!(r["bvid"], "BV0000000001");
        assert_eq!(r["dateBasis"], "event");
        assert_eq!(r["titleSession"]["date"], "2024-01-03");
    }
    for day in [2, 3] {
        assert_eq!(body["days"][day]["recordings"], json!([]));
    }
    let unknown = timeline(&a, "2024-01-04", "2024-01-04", None)?;
    assert_eq!(unknown["days"][0]["recordings"][0]["dateBasis"], "title");
    assert_eq!(unknown["days"][0]["recordings"][0]["eventIds"], json!([]));
    assert_eq!(
        timeline(&a, "2024-01-01", "2024-01-02", Some(Member::Youen))?["days"][0]["recordings"],
        json!([])
    );
    Ok(())
}
#[test]
fn title_aliases_and_artist_names_are_searched_independently() -> Result<()> {
    let a = fixture()?;
    for (q, artist, total) in [
        (Some("BC"), None, 0),
        (Some("ＣＤ"), None, 1),
        (None, Some("FG"), 0),
        (None, Some("ＧＨ"), 1),
    ] {
        let response = a.search_works(SearchQuery {
            q: q.map(str::to_owned),
            artist: artist.map(str::to_owned),
            limit: 20,
            offset: 0,
        });
        assert_eq!(response.page.total, total);
    }
    Ok(())
}
