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
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
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
    pub cache: Arc<RwLock<HashMap<String, String>>>,
}

// Define the embedded folder pointing to your SvelteKit build output
#[derive(RustEmbed)]
#[folder = "../build/"]
struct Assets;

pub async fn start_server(
    tx: broadcast::Sender<String>,
    cache: Arc<RwLock<HashMap<String, String>>>,
) {
    let app_state = Arc::new(AppState { tx, cache });

    let app = Router::new()
        .route("/ws", get(ws_handler))
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

    // INSTANT STATE SYNC: Send the latest cached payloads immediately upon connection
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
