use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    http::{header, StatusCode, Uri},
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use rust_embed::RustEmbed;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs; // NEW: For reading config
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir; // NEW: For serving physical files // NEW: To access AppHandle paths

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CueData {
    #[serde(rename = "type")]
    pub cue_type: Option<String>,
    pub text: String,
    #[serde(rename = "subText")]
    pub sub_text: Option<String>,
}

pub struct AppState {
    pub tx: broadcast::Sender<String>,
    pub cache: Arc<RwLock<HashMap<String, String>>>,
}

// NEW: Struct to read your custom workspace path
#[derive(Serialize, Deserialize, Default)]
struct CoreConfig {
    workspace_path: Option<String>,
    db_path: Option<String>,
}

#[derive(RustEmbed)]
#[folder = "../build/"]
struct Assets;

pub async fn start_server(
    tx: broadcast::Sender<String>,
    cache: Arc<RwLock<HashMap<String, String>>>,
    app_handle: tauri::AppHandle, // NEW: Required to find the media folder
) {
    let app_state = Arc::new(AppState { tx, cache });

    // --- NEW: Find the workspace media directory ---
    let app_dir = app_handle.path().app_data_dir().unwrap();
    let config_path = app_dir.join("wcp_core.json");
    let config: CoreConfig = fs::read_to_string(&config_path)
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default();

    let media_dir = config
        .workspace_path
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_dir.clone())
        .join("media"); // Target the media subfolder

    // --- NEW: Attach the media directory to the /media route ---
    let app = Router::new()
        .nest_service("/media", ServeDir::new(media_dir)) // Remote displays can now fetch from here!
        .route("/ws", get(ws_handler))
        .fallback(get(static_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    match tokio::net::TcpListener::bind("0.0.0.0:8080").await {
        Ok(listener) => {
            if let Ok(addr) = listener.local_addr() {
                println!("OBS HTTP & WebSocket Server listening on {}", addr);
            }

            if let Err(e) = axum::serve(listener, app).await {
                eprintln!("Axum server encountered an error: {}", e);
            }
        }
        Err(e) => {
            eprintln!(
                "CRITICAL: Failed to bind to port 8080. Another application is likely using this port. Error: {}",
                e
            );
        }
    }
}

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            if let Some(index) = Assets::get("index.html") {
                ([(header::CONTENT_TYPE, "text/html")], index.data).into_response()
            } else {
                (StatusCode::NOT_FOUND, "404 Not Found").into_response()
            }
        }
    }
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    {
        let cache = state.cache.read().await;
        for (_, msg) in cache.iter() {
            let _ = sender.send(Message::Text(msg.clone())).await;
        }
    }

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task =
        tokio::spawn(async move { while let Some(Ok(_)) = receiver.next().await {} });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
}
