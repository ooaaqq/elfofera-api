use anyhow::Result;
use elfofera_api::{contract::SearchQuery, data::Archive};
use std::{fs, path::Path};

fn inputs(path: &Path) -> Result<()> {
    fs::write(path.join("songs.json"), r#"{"works":[]}"#)?;
    fs::write(path.join("plans.json"), r#"{"days":[]}"#)?;
    Ok(())
}

#[test]
fn rejects_unrecognized_inputs_and_invalid_periods() -> Result<()> {
    for name in [
        "events-2024-13.json",
        "event-2024-01.json",
        "recordings.json",
    ] {
        let directory = tempfile::tempdir()?;
        inputs(directory.path())?;
        fs::write(directory.path().join(name), "{}")?;
        let error = Archive::read(directory.path())
            .err()
            .ok_or_else(|| anyhow::anyhow!("accepted {name}"))?;
        assert!(error.to_string().contains(name), "{error}");
    }
    Ok(())
}

#[test]
fn rejects_input_directories_and_reports_json_filename() -> Result<()> {
    let directory = tempfile::tempdir()?;
    inputs(directory.path())?;
    fs::create_dir(directory.path().join("unexpected"))?;
    assert!(Archive::read(directory.path()).is_err());
    fs::remove_dir(directory.path().join("unexpected"))?;
    fs::write(directory.path().join("events-2024-01.json"), "{")?;
    let error = Archive::read(directory.path())
        .err()
        .ok_or_else(|| anyhow::anyhow!("accepted invalid JSON"))?;
    assert!(error.to_string().contains("events-2024-01.json"));
    Ok(())
}

#[test]
fn confirmed_archive_survives_snapshot_reload() -> Result<()> {
    let archive = Archive::read(Path::new("data/calendar/confirmed"))?;
    let reloaded = from_value(serde_json::to_value(&archive.data)?)?;
    let query = || SearchQuery {
        q: Some("月".into()),
        artist: None,
        limit: 3,
        offset: 0,
    };
    assert_eq!(
        serde_json::to_value(archive.search_works(query()))?,
        serde_json::to_value(reloaded.search_works(query()))?
    );
    assert!(!archive.data.events.is_empty());
    Ok(())
}

fn from_value(value: serde_json::Value) -> anyhow::Result<Archive> {
    Archive::new(serde_json::from_value(value)?)
}
