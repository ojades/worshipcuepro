// /src-tauri/src/obs.rs
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
use std::sync::Arc;
use tokio::sync::broadcast;
use tower_http::cors::CorsLayer;

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
}

// 1. Define the embedded folder pointing to your SvelteKit build output
#[derive(RustEmbed)]
#[folder = "../build/"] // Change to "../dist/" if you use Vite's default output
struct Assets;

pub async fn start_server(tx: broadcast::Sender<String>) {
    let app_state = Arc::new(AppState { tx });

    let app = Router::new()
        // WebSocket route
        .route("/ws", get(ws_handler))
        // 2. Catch-all fallback route for serving static files from memory
        .fallback(get(static_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!(
        "OBS HTTP & WebSocket Server listening on {}",
        listener.local_addr().unwrap()
    );

    axum::serve(listener, app).await.unwrap();
}

// 3. Handler to serve embedded files and handle SPA routing
async fn static_handler(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');

    // If the path is empty, default to index.html
    let path = if path.is_empty() { "index.html" } else { path };

    // Try to get the file from the embedded assets
    match Assets::get(path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => {
            // SPA Fallback: If file is not found (e.g., /stage), serve index.html
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

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(_)) = receiver.next().await {
            // Keep connection alive
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
}
