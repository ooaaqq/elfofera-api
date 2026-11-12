use anyhow::{Context, Result, ensure};
use elfofera_api::{
    data::Archive,
    model::{
        Asset, ContentType, Dimension, Event, EventKind, EvidenceBasis, Member, Participation,
        Performance, Plan,
    },
};
use std::path::Path;

fn confirmed() -> Result<Archive> {
    Archive::read(Path::new("data/calendar/confirmed"))
}
fn with_video<'a>(archive: &'a Archive, bvid: &str) -> Vec<&'a Performance> {
    archive
        .data
        .performances
        .iter()
        .filter(|p| {
            p.assets
                .iter()
                .any(|a| a.bvid().is_some_and(|b| b.as_str() == bvid))
        })
        .collect()
}
fn sole<T>(items: &[T]) -> Result<&T> {
    ensure!(items.len() == 1, "expected one record, got {}", items.len());
    items.first().context("record")
}
fn event<'a>(archive: &'a Archive, p: &Performance) -> &'a Event {
    &archive.data.events[archive.events[&p.event_id]]
}
fn sessions<'a>(archive: &'a Archive, date: &str, member: Option<Member>) -> Vec<&'a Event> {
    archive
        .data
        .events
        .iter()
        .filter(|e| {
            e.date.to_string() == date
                && e.kind == EventKind::Livestream
                && member.is_none_or(|m| e.recording_named_members.contains(&m))
        })
        .collect()
}
fn plan<'a>(archive: &'a Archive, date: &str) -> Result<&'a Plan> {
    archive
        .data
        .plans
        .iter()
        .find(|p| p.date.to_string() == date)
        .context("plan")
}
fn has_video(assets: &[Asset], bvid: &str) -> bool {
    assets
        .iter()
        .any(|a| a.bvid().is_some_and(|b| b.as_str() == bvid))
}

#[test]
fn character_roles_preserve_luzao_identity_and_alternate_clips() -> Result<()> {
    let a = confirmed()?;
    for bvid in [
        "BV1rSwSe6ESs",
        "BV1A2wSekE2K",
        "BV1CgA5eVEpB",
        "BV1r3A5ekEng",
        "BV1zjA5euEpP",
        "BV1uZAVepE8N",
        "BV1yTA5eLECa",
        "BV1mfAVeDEnA",
        "BV1yMA5eyEJz",
        "BV1WTAWeTEQc",
        "BV1yaeHz6EUD",
    ] {
        let matches = with_video(&a, bvid);
        let p = sole(&matches)?;
        assert!(p.credited_members.contains(&Member::Luzao), "{bvid}");
        assert!(!p.credited_performers.iter().any(|p| p == "路翼"));
    }
    for (primary, alternate) in [
        ("BV1A2wSekE2K", "BV1UZAVeHEJe"),
        ("BV1yTA5eLECa", "BV1vNALeiEQk"),
        ("BV1mfAVeDEnA", "BV1VgALeAEBF"),
        ("BV1yMA5eyEJz", "BV1LTALeKEBv"),
        ("BV1WTAWeTEQc", "BV1tZApeVEFV"),
    ] {
        let matches = with_video(&a, primary);
        let p = sole(&matches)?;
        assert!(has_video(&p.assets, alternate));
        assert!(a.events.contains_key(&p.event_id));
        assert_eq!(with_video(&a, alternate).len(), 1);
    }
    let publication = a
        .data
        .events
        .iter()
        .find(|e| has_video(&e.assets, "BV1pH8t6oEVu"))
        .context("character publication")?;
    assert_eq!(publication.credited_members, [Member::Luzao]);
    assert!(
        publication
            .text
            .as_deref()
            .context("publication text")?
            .contains("Karmen,路翼")
    );
    for bvid in [
        "BV1f6AAzYEs1",
        "BV1kYAAzMEwH",
        "BV1hdAAzpEE3",
        "BV1dzpn61Efe",
        "BV1Rkpn6CEtA",
        "BV162p765EB9",
    ] {
        let matches = with_video(&a, bvid);
        let p = sole(&matches)?;
        assert_eq!(p.credited_members, [Member::Luzao]);
        assert_eq!(event(&a, p).kind, EventKind::Livestream);
    }
    let matches = with_video(&a, "BV1Lnph6zEVr");
    assert_eq!(event(&a, sole(&matches)?).kind, EventKind::Publication);
    Ok(())
}

#[test]
fn programme_series_follow_confirmed_identity_instead_of_similar_titles() -> Result<()> {
    let a = confirmed()?;
    for date in ["2026-01-27", "2026-05-07", "2026-06-11"] {
        let matches = sessions(&a, date, None)
            .into_iter()
            .filter(|e| e.title.contains("御姐玩萌妹") || e.title.contains("萌妹玩御姐"))
            .collect::<Vec<_>>();
        let e = sole(&matches)?;
        assert_eq!(e.series.as_deref(), Some("御姐玩萌妹"));
        assert!(
            e.recording_named_members.contains(&Member::Luzao)
                && e.recording_named_members.contains(&Member::Youen)
        );
    }
    let named = |title: &str| -> Result<&Event> {
        a.data
            .events
            .iter()
            .find(|e| e.title == title)
            .context("programme")
    };
    let game = named("萌妹玩御姐！！46")?;
    assert_eq!(game.recording_named_members, [Member::Luzao]);
    assert_eq!(game.series.as_deref(), Some("萌妹玩游戏"));
    assert_eq!(game.content_type, Some(ContentType::Game));
    assert_eq!(game.dimension, Some(Dimension::Two));
    assert_eq!(
        game.guests
            .iter()
            .map(|g| g.account_id.get())
            .collect::<Vec<_>>(),
        [1203217682, 1878154667]
    );
    for title in ["萌妹爱聊天38", "萌妹徒步中47"] {
        assert_eq!(named(title)?.series.as_deref(), Some("萌妹玩游戏"));
    }
    assert_eq!(named("萌妹爱聊天38")?.content_type, Some(ContentType::Talk));
    let repeat = a
        .data
        .events
        .iter()
        .filter(|e| {
            e.date.to_string().starts_with("2026-01") && e.title.starts_with("萌妹玩游戏18")
        })
        .collect::<Vec<_>>();
    assert_eq!(
        repeat
            .iter()
            .map(|e| e.date.to_string())
            .collect::<Vec<_>>(),
        ["2026-01-18", "2026-01-24"]
    );
    assert!(
        repeat
            .iter()
            .all(|e| e.series.as_deref() == Some("萌妹玩游戏"))
    );
    assert_eq!(named("萌妹爱聊天")?.series.as_deref(), Some("萌妹爱聊天"));
    assert_eq!(
        named("继续，看新，三国，吐槽")?.series.as_deref(),
        Some("看新三国")
    );
    assert!(named("和朋友们的鹅鸭杀初体验！!")?.series.is_none());
    let investigation = sessions(&a, "2026-01-29", None)
        .into_iter()
        .filter(|e| e.title.contains("大侦探"))
        .collect::<Vec<_>>();
    assert_eq!(investigation.len(), 2);
    assert!(
        investigation
            .iter()
            .all(|e| e.series.as_deref() == Some("UP大侦探"))
    );
    Ok(())
}

#[test]
fn stages_restarts_and_separated_sessions_keep_their_actual_boundaries() -> Result<()> {
    let a = confirmed()?;
    let matches = sessions(&a, "2026-05-23", Some(Member::Luzao));
    let e = sole(&matches)?;
    assert_eq!(
        e.stages.iter().map(|s| s.dimension).collect::<Vec<_>>(),
        [Dimension::Two, Dimension::One]
    );
    assert_eq!(
        e.stages
            .iter()
            .flat_map(|s| s.recording_bvids.iter().map(|b| b.as_str()))
            .collect::<Vec<_>>(),
        ["BV1PhGB6SErc", "BV1oUGB6TEM5", "BV1AqG66WE1P"]
    );
    let matches = sessions(&a, "2025-06-06", Some(Member::Luzao));
    let e = sole(&matches)?;
    assert_eq!(
        e.stages
            .iter()
            .map(|s| s.title.as_str())
            .collect::<Vec<_>>(),
        ["抢救中，", "一起唱歌!"]
    );
    assert!(
        e.preferred_recording_bvid
            .as_ref()
            .is_some_and(|b| has_video(&e.recordings, b.as_str()))
    );
    for (date, member, hours) in [
        ("2024-07-08", Member::Waner, [0, 18]),
        ("2025-04-15", Member::Luzao, [20, 23]),
    ] {
        let matches = sessions(&a, date, Some(member));
        assert_eq!(matches.len(), 2);
        let mut actual = matches
            .iter()
            .flat_map(|e| e.title_hours.iter().copied())
            .collect::<Vec<_>>();
        actual.sort();
        assert_eq!(actual, hours);
    }
    let matches = sessions(&a, "2024-03-15", None);
    let e = sole(&matches)?;
    assert!(has_video(&e.recordings, "BV122421A7QX") && has_video(&e.recordings, "BV14K421v7oA"));
    let matches = sessions(&a, "2026-03-06", None)
        .into_iter()
        .filter(|e| e.title.contains("三角洲"))
        .collect::<Vec<_>>();
    let e = sole(&matches)?;
    assert_eq!(e.recordings.len(), 1);
    assert_eq!(
        e.preferred_recording_bvid.as_ref().map(|b| b.as_str()),
        Some("BV1KRPxzjE2z")
    );
    for id in [
        "evt_014c4fcc-a237-486e-b1de-9d0706837be0",
        "evt_2dc5c67a-0d45-4ec5-9eea-6c5093f6e34c",
    ] {
        let e = &a.data.events[a.events[id]];
        assert_eq!(e.kind, EventKind::Livestream);
        assert_eq!(e.content_type, Some(ContentType::Celebration));
        assert_eq!(e.dimension, Some(Dimension::Three));
        assert!(a.data.performances.iter().any(|p| p.event_id == id));
    }
    Ok(())
}

#[test]
fn adopted_work_and_event_associations_preserve_dates_identity_and_renditions() -> Result<()> {
    let a = confirmed()?;
    let matches = with_video(&a, "BV1PYfpYdEwQ");
    let e = event(&a, sole(&matches)?);
    assert_eq!(e.date.to_string(), "2025-01-24");
    assert_eq!(e.kind, EventKind::Activity);
    assert_eq!(e.title, "冰火歌会2025新春季");
    let matches = with_video(&a, "BV1JeraYNEjs");
    let p = sole(&matches)?;
    assert_eq!(p.date.to_string(), "2025-01-08");
    assert_eq!(event(&a, p).title, "串子大检验");
    assert!(has_video(&p.assets, "BV18LraY7Ehi"));
    let matches = with_video(&a, "BV1Pw4m1d7vC")
        .into_iter()
        .filter(|p| p.work_id == "song_479b976a-6cda-44f3-89a6-6cdb135c7248")
        .collect::<Vec<_>>();
    assert_eq!(matches.len(), 2);
    let mut parts = matches
        .iter()
        .flat_map(|p| {
            p.assets
                .iter()
                .filter(|a| a.bvid().is_some_and(|b| b.as_str() == "BV1Pw4m1d7vC"))
                .map(|a| a.part_numbers().iter().map(|n| n.get()).collect::<Vec<_>>())
        })
        .collect::<Vec<_>>();
    parts.sort();
    assert_eq!(parts, [vec![2], vec![9]]);
    let matches = with_video(&a, "BV1k1421R7GJ");
    let p = sole(&matches)?;
    let w = &a.data.works[a.works[&p.work_id]];
    assert_eq!(w.original_artists, ["张韶涵"]);
    assert!(has_video(&p.assets, "BV1eZ421n7Ji"));
    assert!(
        a.data
            .works
            .iter()
            .any(|w| w.title == "最近好吗" && w.original_artists.contains(&"金莎".into()))
    );
    let matches = with_video(&a, "BV1sH4y1e7r7");
    let p = sole(&matches)?;
    let e = event(&a, p);
    assert_eq!(e.date.to_string(), "2024-02-02");
    assert_eq!(e.kind, EventKind::Activity);
    assert_eq!(p.credited_members, [Member::Minuo, Member::Youen]);
    assert_eq!(p.credited_performers, ["露米Lumi_Official"]);
    assert_eq!(e.guests[0].account_id.get(), 2000609327);
    let matches = with_video(&a, "BV1eirsBFEdG");
    let p = sole(&matches)?;
    assert_eq!(p.date.to_string(), "2026-01-14");
    assert_eq!(event(&a, p).title, "妈妈爱听的歌");
    assert!(p.sources.iter().any(|s| {
        s.summary
            .as_ref()
            .is_some_and(|text| text.contains("25.01.14"))
    }));
    Ok(())
}

#[test]
fn current_plans_and_changes_do_not_replace_actual_broadcast_evidence() -> Result<()> {
    let a = confirmed()?;
    let matches = sessions(&a, "2026-10-29", None);
    let e = sole(&matches)?;
    assert!(
        e.recording_named_members.contains(&Member::Luzao)
            && e.recording_named_members.contains(&Member::Youen)
    );
    assert_eq!(
        e.preferred_recording_bvid.as_ref().map(|b| b.as_str()),
        Some("BV1opsf6ZEJx")
    );
    for bvid in ["BV1ETsX61E6u", "BV1ETsX61EyX"] {
        let matches = with_video(&a, bvid);
        let p = sole(&matches)?;
        assert_eq!(p.date.to_string(), "2026-10-28");
        assert_eq!(
            event(&a, p)
                .preferred_recording_bvid
                .as_ref()
                .map(|b| b.as_str()),
            Some("BV1Ayx764EiN")
        );
    }
    let p = plan(&a, "2026-11-01")?;
    let en = &sole(&p.entries)?.arrangement;
    assert_eq!(en.members, [Member::Youen]);
    assert_eq!(serde_json::to_value(&en.planned_time)?, "19:30");
    assert_eq!(en.format_label.as_deref(), Some("电台"));
    let p = plan(&a, "2026-10-15")?;
    let en = &sole(&p.entries)?.arrangement;
    assert_eq!(en.members, [Member::Luzao, Member::Youen]);
    assert_eq!(serde_json::to_value(&en.planned_time)?, "19:00");
    assert!(en.format_label.is_none());
    assert!(matches!(
        en.participation,
        Some(Participation::Collaboration)
    ));
    assert_eq!(en.host_member, Some(Member::Luzao));
    let matches = sessions(&a, "2026-10-15", None);
    let e = sole(&matches)?;
    assert_eq!(e.basis, EvidenceBasis::Recording);
    assert_eq!(e.dimension, Some(Dimension::Three));
    assert_eq!(e.title_hours, [18]);
    assert_eq!(
        e.preferred_recording_bvid.as_ref().map(|b| b.as_str()),
        Some("BV1LPJm6yEgW")
    );
    assert!(plan(&a, "2026-10-19")?.sources.iter().any(|s| {
        s.url
            .contains("c9ba992201c80f1dc01d660cd01f41662018113152.jpg")
    }));
    for (date, time, format) in [("2026-10-20", "20:00", "2D"), ("2026-10-22", "19:00", "3D")] {
        let p = plan(&a, date)?;
        let en = &p.entries[0].arrangement;
        assert_eq!(en.members, [Member::Youen]);
        assert_eq!(serde_json::to_value(&en.planned_time)?, time);
        assert_eq!(en.format_label.as_deref(), Some(format));
    }
    let rest = plan(&a, "2026-10-23")?;
    assert_eq!(rest.rest_day, Some(true));
    assert!(rest.entries.is_empty());
    for e in a.data.events.iter().filter(|e| {
        e.date.to_string().as_str() >= "2026-10-19"
            && e.date.to_string().as_str() <= "2026-10-25"
            && e.kind == EventKind::Livestream
    }) {
        assert_eq!(e.basis, EvidenceBasis::Recording);
        assert!(e.preferred_recording_bvid.is_some());
        assert!(!e.recordings.is_empty());
    }
    assert_eq!(
        plan(&a, "2026-10-17")?.entries[0].arrangement.members,
        [Member::Youen]
    );
    assert_eq!(
        plan(&a, "2026-10-18")?.entries[0].arrangement.members,
        [Member::Luzao]
    );
    let changes = a
        .data
        .changes
        .iter()
        .filter(|c| {
            c.action == elfofera_api::model::ChangeAction::Reschedule
                && c.announced_on
                    .is_some_and(|d| d.to_string() == "2026-10-12")
        })
        .collect::<Vec<_>>();
    assert_eq!(changes.len(), 2);
    for c in changes {
        assert_eq!(c.before[0].events[0].members, c.members);
        assert_ne!(c.before[0].date, c.after[0].date);
        assert!(c.event_ids.is_empty());
        assert_eq!(c.announcement_event_ids.len(), 1);
    }
    Ok(())
}
