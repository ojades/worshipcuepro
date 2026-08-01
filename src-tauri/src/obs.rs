// /src-tauri/src/obs.rs
use axum::{
    extract::{
        ws::{Message, WebSocket},
        State, WebSocketUpgrade,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use futures_util::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf, sync::Arc};
use tokio::sync::broadcast;
use tower_http::{
    cors::CorsLayer,
    services::{ServeDir, ServeFile},
};

// This matches your Svelte state exactly
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

pub async fn start_server(tx: broadcast::Sender<String>, static_dir: PathBuf) {
    let app_state = Arc::new(AppState { tx });

    // Serve the Svelte files, and fallback to index.html for SPA routing (e.g., /obs)
    let serve_dir =
        ServeDir::new(&static_dir).not_found_service(ServeFile::new(static_dir.join("index.html")));

    let app = Router::new()
        // Mount the Svelte app at the root URL
        .nest_service("/", serve_dir)
        // Keep the WebSocket route intact
        .route("/ws", get(ws_handler))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!(
        "OBS HTTP & WebSocket Server listening on {}",
        listener.local_addr().unwrap()
    );

    axum::serve(listener, app).await.unwrap();
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> impl IntoResponse {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.tx.subscribe();

    // Task 1: Forward broadcast messages to the connected OBS client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break; // Client disconnected
            }
        }
    });

    // Task 2: Listen for disconnects from the client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(_)) = receiver.next().await {
            // We ignore incoming messages from OBS, we just want to keep the connection alive
        }
    });

    // If either task fails/closes, abort the other one
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
}
