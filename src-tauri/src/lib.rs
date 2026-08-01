// /src-tauri/src/lib.rs
use reqwest::Client;
use tauri::Manager;
use tokio::sync::broadcast;

pub mod commands;
pub mod obs;

use commands::api_bible::{
    get_bible_books, get_bible_chapters, get_bible_verse_text, get_bible_verses,
    get_bible_versions, ApiHttpClient,
};

use commands::youversion::{get_youversion_index, get_youversion_verses, get_youversion_versions};
// Tauri managed state to hold our broadcast sender
pub struct ServerState {
    pub tx: broadcast::Sender<String>,
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

// Command for Svelte to send a cue to OBS
#[tauri::command]
async fn broadcast_to_obs(
    cue_data: obs::CueData,
    state: tauri::State<'_, ServerState>,
) -> Result<(), String> {
    // Serialize the Rust struct into a JSON string
    let payload = serde_json::to_string(&cue_data).map_err(|e| e.to_string())?;

    // Broadcast it to all connected OBS WebSockets.
    // We ignore errors here because an error just means no clients are currently connected.
    let _ = state.tx.send(payload);

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let http_client = Client::new();
    tauri::Builder::default()
        .manage(ApiHttpClient(http_client))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Create a broadcast channel with a capacity of 100 messages
            let (tx, _rx) = broadcast::channel(100);

            // Allow Tauri commands to access the sender
            app.manage(ServerState { tx: tx.clone() });

            // Determine where the Svelte static files are located
            #[cfg(debug_assertions)]
            let static_dir = std::env::current_dir().unwrap().join("../build"); // Dev mode: look outside the src-tauri folder

            #[cfg(not(debug_assertions))]
            let static_dir = app.path().resource_dir().unwrap().join("build"); // Prod mode: look inside the bundled resources

            // Spawn the Axum server in the background
            tauri::async_runtime::spawn(async move {
                obs::start_server(tx, static_dir).await;
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
            broadcast_to_obs,
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
