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
        #[arg(long, default_value = "127.0.0.1:3000")]
        listen: std::net::SocketAddr,
    },
}
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_ansi(false).init();
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
        Command::Serve { snapshot, listen } => {
            let archive = Archive::new(read_json(&snapshot)?)
                .with_context(|| format!("invalid snapshot {}", snapshot.display()))?;
            let app = router(App {
                archive,
                contract: Contract::new()?,
            });
            let mut terminate =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
            let mut interrupt =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())?;
            let shutdown = async {
                tokio::select! { value=terminate.recv()=>value,value=interrupt.recv()=>value }
            };
            let listener = tokio::net::TcpListener::bind(listen).await?;
            tracing::info!(address=%listener.local_addr()?,"archive API ready");
            let (stop_tx, stop_rx) = tokio::sync::oneshot::channel();
            let server = axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    let _ = stop_rx.await;
                })
                .into_future();
            tokio::pin!(server);
            tokio::select! {
                result=&mut server=>result.context("HTTP server failed")?,
                result=shutdown=>{
                    result.context("signal stream closed")?;
                    let _=stop_tx.send(());
                    tokio::time::timeout(Duration::from_secs(10),server).await.context("graceful shutdown timed out")??;
                },
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
