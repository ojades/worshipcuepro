use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::{broadcast, RwLock};

pub mod commands;
pub mod obs;

use commands::api_bible::{
    get_bible_books, get_bible_chapters, get_bible_verse_text, get_bible_verses,
    get_bible_versions, ApiHttpClient,
};
use commands::youversion::{get_youversion_index, get_youversion_verses, get_youversion_versions};

// Tauri managed state to hold our broadcast sender AND our state cache
pub struct ServerState {
    pub tx: broadcast::Sender<String>,
    pub cache: Arc<RwLock<HashMap<String, String>>>,
}

#[tauri::command]
async fn close_splashscreen(app: tauri::AppHandle) {
    if let Some(splashscreen) = app.get_webview_window("splashscreen") {
        let _ = splashscreen.close();
    }
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.set_focus();
    }
}

// Command for Svelte to send a cue to OBS/Remote Display
#[tauri::command]
async fn broadcast_payload(
    event_type: String,
    payload: serde_json::Value,
    state: tauri::State<'_, ServerState>,
) -> Result<(), String> {
    let message = serde_json::json!({
        "type": &event_type,
        "payload": payload
    });

    let json_string = serde_json::to_string(&message).map_err(|e| e.to_string())?;

    // 1. Save the latest payload to the cache so new connections get it instantly
    {
        let mut cache = state.cache.write().await;
        cache.insert(event_type, json_string.clone());
    }

    // 2. Broadcast over Axum WebSocket channel
    let _ = state.tx.send(json_string);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_client = Client::new();
    tauri::Builder::default()
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { .. } => {
                if window.label() == "main" {
                    window.app_handle().exit(0);
                }
            }
            _ => {}
        })
        .manage(ApiHttpClient(http_client))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Create a broadcast channel with a capacity of 100 messages
            let (tx, _rx) = broadcast::channel(100);

            // Create the thread-safe state cache
            let cache = Arc::new(RwLock::new(HashMap::new()));

            // Allow Tauri commands to access the sender and cache
            app.manage(ServerState {
                tx: tx.clone(),
                cache: cache.clone(),
            });

            // Spawn the Axum server in the background
            let tx_clone = tx.clone();
            let cache_clone = cache.clone();
            tauri::async_runtime::spawn(async move {
                obs::start_server(tx_clone, cache_clone).await;
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            close_splashscreen,
            commands::display::launch_projector,
            commands::display::close_projector,
            commands::display::is_projector_open,
            commands::display::launch_stage,
            commands::display::close_stage,
            commands::display::is_stage_open,
            commands::display::get_displays,
            commands::network::get_local_ip,
            commands::lyrics::search_genius,
            commands::lyrics::scrape_genius_lyrics,
            broadcast_payload,
            get_bible_versions,
            get_bible_books,
            get_bible_chapters,
            get_bible_verses,
            get_bible_verse_text,
            get_youversion_versions,
            get_youversion_index,
            get_youversion_verses,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
