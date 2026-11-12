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

#[tokio::test]
async fn built_snapshot_serves_health_and_terminates_gracefully() -> Result<()> {
    use std::{process::Stdio, time::Duration};
    use tokio::{
        io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt},
        time::timeout,
    };
    let directory = tempfile::tempdir()?;
    let source = directory.path().join("source");
    let output = directory.path().join("output");
    fs::create_dir(&source)?;
    fs::write(source.join("plans.json"), r#"{"days":[]}"#)?;
    fs::write(source.join("songs.json"), r#"{"works":[]}"#)?;
    ensure!(build(&source, &output)?.status.success(), "build failed");
    let mut child = tokio::process::Command::new(env!("CARGO_BIN_EXE_elfofera-api"))
        .arg("serve")
        .arg("--snapshot")
        .arg(output.join("archive.json"))
        .args(["--listen", "127.0.0.1:0"])
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true)
        .spawn()?;
    let mut lines =
        tokio::io::BufReader::new(child.stdout.take().context("server stdout")?).lines();
    let line = timeout(Duration::from_secs(10), lines.next_line())
        .await??
        .context("server closed before readiness")?;
    assert!(line.contains("archive API ready"), "{line}");
    let address = line
        .split("address=")
        .nth(1)
        .context("ready address")?
        .trim();
    let response = timeout(Duration::from_secs(5), async {
        let mut connection = tokio::net::TcpStream::connect(address).await?;
        connection
            .write_all(b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            .await?;
        let mut response = String::new();
        connection.read_to_string(&mut response).await?;
        Ok::<_, std::io::Error>(response)
    })
    .await??;
    assert!(response.starts_with("HTTP/1.1 200"));
    assert!(response.contains(r#"{"service":"available"}"#));
    let pid = child.id().context("server process")?;
    let signal = tokio::process::Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .status()
        .await?;
    assert!(signal.success());
    let status = timeout(Duration::from_secs(15), child.wait()).await??;
    assert!(status.success(), "{status}");
    Ok(())
}
