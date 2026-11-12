use anyhow::{Context, Result, ensure};
use elfofera_api::{
    data::{Archive, read_json},
    model::Dataset,
};
use serde_json::{Value, json};
use std::{fs, path::Path, process::Command};

fn build(source: &Path, output: &Path) -> Result<std::process::Output> {
    Ok(Command::new(env!("CARGO_BIN_EXE_elfofera-api"))
        .arg("build")
        .arg("--source")
        .arg(source)
        .arg("--output")
        .arg(output)
        .output()?)
}
#[test]
fn build_is_deterministic_and_failed_input_preserves_existing_outputs() -> Result<()> {
    let directory = tempfile::tempdir()?;
    let source = directory.path().join("source");
    let output = directory.path().join("output");
    fs::create_dir(&source)?;
    fs::write(source.join("plans.json"), r#"{"days":[]}"#)?;
    let works = json!({"works":[{"id":"b","title":"Beta"},{"id":"a","title":"Alpha"}]});
    fs::write(source.join("songs.json"), serde_json::to_vec(&works)?)?;
    let result = build(&source, &output)?;
    ensure!(
        result.status.success(),
        "build failed: {}",
        String::from_utf8_lossy(&result.stderr)
    );
    let names = ["archive.json", "tools.json", "openapi.json", "members.json"];
    let before = names
        .iter()
        .map(|n| fs::read(output.join(n)))
        .collect::<std::io::Result<Vec<_>>>()?;
    let dataset: Dataset = read_json(&output.join("archive.json"))?;
    assert_eq!(dataset.works[0].id, "a");
    Archive::new(dataset)?;
    let contract: Value = read_json(&output.join("openapi.json"))?;
    assert_eq!(contract["info"]["version"], env!("CARGO_PKG_VERSION"));
    let mut reversed = works;
    reversed["works"].as_array_mut().context("works")?.reverse();
    fs::write(source.join("songs.json"), serde_json::to_vec(&reversed)?)?;
    ensure!(
        build(&source, &output)?.status.success(),
        "second build failed"
    );
    for (i, name) in names.iter().enumerate() {
        assert_eq!(fs::read(output.join(name))?, before[i], "{name}");
    }
    fs::write(
        source.join("songs.json"),
        r#"{"works":[{"id":"bad","title":3}]}"#,
    )?;
    let failed = build(&source, &output)?;
    assert!(!failed.status.success());
    let error = String::from_utf8(failed.stderr)?;
    assert!(
        error.contains("songs.json") && error.contains("works[0].title"),
        "{error}"
    );
    for (i, name) in names.iter().enumerate() {
        assert_eq!(fs::read(output.join(name))?, before[i], "{name}");
    }
    assert_eq!(
        fs::read_dir(&output)?.count(),
        4,
        "temporary output files must be removed"
    );
    Ok(())
}
