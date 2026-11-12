use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use elfofera_api::{
    contract::Contract,
    data::{Archive, read_json},
    http::{App, router},
};
use std::{
    future::IntoFuture,
    path::{Path, PathBuf},
    time::Duration,
};

#[derive(Parser)]
#[command(version)]
struct Args {
    #[command(subcommand)]
    command: Command,
}
#[derive(Subcommand)]
enum Command {
    Build {
        #[arg(long, default_value = "data/calendar/confirmed")]
        source: PathBuf,
        #[arg(long, default_value = "dist")]
        output: PathBuf,
    },
    Contract {
        #[arg(long)]
        output: PathBuf,
    },
    Serve {
        #[arg(long)]
        snapshot: PathBuf,
    },
}
async fn shutdown() -> Result<()> {
    let mut term = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
    tokio::select! {r=tokio::signal::ctrl_c()=>r?,_=term.recv()=>{}}
    Ok(())
}
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    match Args::parse().command {
        Command::Contract { output } => {
            std::fs::create_dir_all(&output)?;
            write_contract(&output, Contract::new()?)?;
        }
        Command::Build { source, output } => {
            let archive = Archive::read(&source)?;
            std::fs::create_dir_all(&output)?;
            let contract = Contract::new()?;
            write_json(&output.join("archive.json"), &archive.data)?;
            write_contract(&output, contract)?;
            tracing::info!(
                events = archive.data.events.len(),
                works = archive.data.works.len(),
                performances = archive.data.performances.len(),
                "validated snapshot built"
            );
        }
        Command::Serve { snapshot } => {
            let archive = Archive::new(read_json(&snapshot)?)?;
            let app = router(App {
                archive,
                contract: Contract::new()?,
            });
            let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await?;
            let (stopped_tx, stopped_rx) = tokio::sync::oneshot::channel();
            let server = axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    if let Err(error) = shutdown().await {
                        tracing::error!(%error,"signal handler failed");
                    }
                    let _ = stopped_tx.send(());
                })
                .into_future();
            tokio::pin!(server);
            tokio::select! {
                result=&mut server=>result.context("HTTP server failed")?,
                _=stopped_rx=>tokio::time::timeout(Duration::from_secs(10),server).await.context("graceful shutdown timed out")??,
            }
        }
    }
    Ok(())
}

fn write_json(path: &Path, value: &impl serde::Serialize) -> Result<()> {
    let directory = path.parent().context("output directory")?;
    let mut temporary = tempfile::NamedTempFile::new_in(directory)?;
    serde_json::to_writer(temporary.as_file_mut(), value)?;
    temporary.as_file().sync_all()?;
    temporary
        .persist(path)
        .with_context(|| format!("replace {}", path.display()))?;
    Ok(())
}
fn write_contract(output: &Path, contract: Contract) -> Result<()> {
    let members = elfofera_api::model::MEMBERS
        .into_iter()
        .map(|member| (member, member.label()))
        .collect::<std::collections::BTreeMap<_, _>>();
    write_json(&output.join("members.json"), &members)?;
    write_json(&output.join("tools.json"), &contract.tools)?;
    write_json(&output.join("openapi.json"), &contract.openapi)?;
    Ok(())
}
