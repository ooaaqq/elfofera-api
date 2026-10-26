use crate::{
    contract::{Availability, Contract, ErrorBody, Health, Input},
    data::Archive,
};
use axum::{
    Json, Router,
    extract::{Path, RawQuery, State},
    http::{HeaderValue, StatusCode, header::CACHE_CONTROL},
    response::{IntoResponse, Response},
    routing::get,
};
use serde_json::{Value, json};
use std::sync::Arc;

pub struct App {
    pub archive: Archive,
    pub contract: Contract,
}
pub fn router(app: App) -> Router {
    Router::new().route("/health",get(||async {([(CACHE_CONTROL,"no-store")],Json(Health {service:Availability::Available}))}))
        .route("/openapi.json",get(|State(app):State<Arc<App>>|async move {Json(app.contract.openapi.clone())}))
        .route("/v1/works",get(|State(app):State<Arc<App>>,RawQuery(query):RawQuery|async move {respond(&app,1,None,query)}))
        .route("/v1/timeline",get(|State(app):State<Arc<App>>,RawQuery(query):RawQuery|async move {respond(&app,0,None,query)}))
        .route("/v1/works/{workId}/history",get(|State(app):State<Arc<App>>,Path(id):Path<String>,RawQuery(query):RawQuery|async move {respond(&app,2,Some(id),query)}))
        .route("/v1/works/{workId}/statistics",get(|State(app):State<Arc<App>>,Path(id):Path<String>,RawQuery(query):RawQuery|async move {respond(&app,3,Some(id),query)}))
        .fallback(||async {(StatusCode::NOT_FOUND,Json(ErrorBody {error:"not_found".to_owned()}))}).with_state(Arc::new(app))
}
fn respond(app: &App, index: usize, id: Option<String>, query: Option<String>) -> Response {
    match result(app, index, id, query) {
        Ok(Some(value)) => {
            let mut response = Json(value).into_response();
            response.headers_mut().insert(
                CACHE_CONTROL,
                HeaderValue::from_static("public, max-age=60"),
            );
            response
        }
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ErrorBody {
                error: "work_not_found".to_owned(),
            }),
        )
            .into_response(),
        Err(error) if error.downcast_ref::<serde_json::Error>().is_some() => {
            tracing::error!(%error,"response serialization failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorBody {
                    error: "internal_server_error".to_owned(),
                }),
            )
                .into_response()
        }
        Err(error) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorBody {
                error: error.to_string(),
            }),
        )
            .into_response(),
    }
}
fn result(
    app: &App,
    index: usize,
    id: Option<String>,
    query: Option<String>,
) -> anyhow::Result<Option<Value>> {
    if let Some(id) = &id {
        app.contract
            .work_path
            .validate(&json!({"workId":id}))
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    }
    let value = match app.contract.definitions[index].parse(query.as_deref())? {
        Input::Search(q) => Some(serde_json::to_value(app.archive.search_works(q))?),
        Input::Timeline(q) => Some(serde_json::to_value(app.archive.timeline(q))?),
        Input::History(q) => app
            .archive
            .history(
                id.as_deref()
                    .ok_or_else(|| anyhow::anyhow!("missing workId"))?,
                q,
            )
            .map(serde_json::to_value)
            .transpose()?,
        Input::Statistics(q) => app
            .archive
            .statistics(
                id.as_deref()
                    .ok_or_else(|| anyhow::anyhow!("missing workId"))?,
                q,
            )
            .map(serde_json::to_value)
            .transpose()?,
    };
    Ok(value)
}
