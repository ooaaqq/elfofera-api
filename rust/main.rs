use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use elfofera_api::{
    contract::Contract,
    data::Archive,
    http::{App, router},
};
use std::{future::IntoFuture, path::PathBuf, time::Duration};

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
        Command::Build { source, output } => {
            let archive = Archive::read(&source)?;
            let contract = Contract::new()?;
            std::fs::create_dir_all(&output)?;
            let members = elfofera_api::model::MEMBERS
                .into_iter()
                .map(|m| {
                    Ok((
                        serde_json::to_value(m)?
                            .as_str()
                            .context("member code")?
                            .to_owned(),
                        serde_json::json!(m.label()),
                    ))
                })
                .collect::<Result<serde_json::Map<String, serde_json::Value>>>()?;
            for (name, value) in [
                ("archive.json", archive.snapshot),
                ("members.json", serde_json::Value::Object(members)),
                ("tools.json", contract.tools),
                ("openapi.json", contract.openapi),
            ] {
                std::fs::write(output.join(name), serde_json::to_vec(&value)?)?;
            }
            tracing::info!(
                events = archive.data.events.len(),
                works = archive.data.works.len(),
                performances = archive.data.performances.len(),
                "validated snapshot built"
            );
        }
        Command::Serve { snapshot } => {
            let archive = Archive::from_value(serde_json::from_slice(&std::fs::read(snapshot)?)?)?;
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
