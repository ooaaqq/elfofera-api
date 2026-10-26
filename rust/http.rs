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
use serde_json::json;
use std::sync::Arc;

pub struct App {
    pub archive: Archive,
    pub contract: Contract,
}
pub fn router(app: App) -> Router {
    let openapi = axum::body::Bytes::from(app.contract.openapi.to_string());
    let mut router = Router::new()
        .route(
            "/health",
            get(|| async {
                (
                    [(CACHE_CONTROL, "no-store")],
                    Json(Health {
                        service: Availability::Available,
                    }),
                )
            }),
        )
        .route(
            "/openapi.json",
            get(move || {
                let openapi = openapi.clone();
                async move {
                    (
                        [(axum::http::header::CONTENT_TYPE, "application/json")],
                        openapi,
                    )
                }
            }),
        );
    for (index, definition) in app.contract.definitions.iter().enumerate() {
        router = router.route(
            definition.path,
            get(
                move |State(app): State<Arc<App>>,
                      Path(path): Path<std::collections::HashMap<String, String>>,
                      RawQuery(query): RawQuery| async move {
                    respond(&app, index, path.get("workId").cloned(), query)
                },
            ),
        );
    }
    router
        .fallback(|| async {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorBody {
                    error: "not_found".to_owned(),
                }),
            )
        })
        .with_state(Arc::new(app))
}
fn respond(app: &App, index: usize, id: Option<String>, query: Option<String>) -> Response {
    match result(app, index, id, query) {
        Ok(Some(value)) => {
            let mut response = value;
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
) -> anyhow::Result<Option<Response>> {
    if let Some(id) = &id {
        app.contract
            .work_path
            .validate(&json!({"workId":id}))
            .map_err(|e| anyhow::anyhow!(e.to_string()))?;
    }
    let value = match app.contract.definitions[index].parse(query.as_deref())? {
        Input::Search(q) => Some(Json(app.archive.search_works(q)).into_response()),
        Input::Timeline(q) => Some(Json(app.archive.timeline(q)).into_response()),
        Input::History(q) => app
            .archive
            .history(
                id.as_deref()
                    .ok_or_else(|| anyhow::anyhow!("missing workId"))?,
                q,
            )
            .map(|value| Json(value).into_response()),
        Input::Statistics(q) => app
            .archive
            .statistics(
                id.as_deref()
                    .ok_or_else(|| anyhow::anyhow!("missing workId"))?,
                q,
            )
            .map(|value| Json(value).into_response()),
    };
    Ok(value)
}
