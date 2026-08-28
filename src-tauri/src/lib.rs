// src-tauri/src/lib.rs
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::{broadcast, RwLock};

pub mod commands;
pub mod db;
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
            .plugin(tauri_plugin_updater::Builder::new().build())
            .plugin(tauri_plugin_process::init())
            .on_window_event(|window, event| match event {
                tauri::WindowEvent::CloseRequested { .. } => {
                    if window.label() == "main" {
                        if let Some(state) = window.try_state::<crate::db::DbState>() {
                            let state_clone = state.inner().clone();

                            tauri::async_runtime::block_on(async move {
                                let db_lock = state_clone.lock().await;
                                let _ = db_lock.conn.execute_batch("
                                    PRAGMA wal_checkpoint(TRUNCATE);
                                    PRAGMA journal_mode = DELETE;
                                ").await;
                            });
                        }

                        commands::db::settings::release_lock_on_exit(window.app_handle());

                        window.app_handle().exit(0);
                    }
                }
                _ => {}
            })
            .manage(ApiHttpClient(http_client))
            .plugin(tauri_plugin_fs::init())
            .plugin(tauri_plugin_dialog::init())
            .plugin(tauri_plugin_opener::init())
            .plugin(tauri_plugin_shell::init())
            .setup(|app| {
                let app_handle = app.handle();
                match tauri::async_runtime::block_on(db::init_db(&app_handle)) {
                    Ok(db_state) => {
                        app.manage(db_state);
                    }
                    Err(e) => {
                        use tauri_plugin_dialog::DialogExt;
                        app.handle()
                            .dialog()
                            .message(format!("WorshipCuePro failed to initialize its database. Please ensure the app has folder permissions.\n\nError: {}", e))
                            .title("Critical Startup Error")
                            .kind(tauri_plugin_dialog::MessageDialogKind::Error)
                            .blocking_show();

                        return Err(Box::new(std::io::Error::new(std::io::ErrorKind::Other, e)));
                    }
                }

                let (tx, _rx) = broadcast::channel(100);
                let cache = Arc::new(RwLock::new(HashMap::new()));

                app.manage(ServerState {
                    tx: tx.clone(),
                    cache: cache.clone(),
                });

                let tx_clone = tx.clone();
                let cache_clone = cache.clone();
                let app_handle_clone = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    obs::start_server(tx_clone, cache_clone, app_handle_clone).await;
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
            commands::db::media::bulk_copy_media,
            commands::db::song::fetch_all_songs,
            commands::db::song::sync_checkpoint,
            commands::db::song::insert_song,
            commands::db::song::update_song,
            commands::db::song::delete_song,
            commands::db::song::search_songs_fts,
            commands::db::bible::get_bible_cache,
            commands::db::bible::set_bible_cache,
            commands::db::bible::clear_bible_cache,
            commands::db::bible::delete_system_bible_cache,
            commands::db::bible::delete_bible_cache,
            commands::db::bible::bulk_insert_bible_fts,
            commands::db::bible::search_bible_fts,
            commands::db::bible::delete_bible_fts_version,
            commands::db::media::fetch_all_media,
            commands::db::media::update_category_by_name,
            commands::db::media::update_media_thumbnail,
            commands::db::media::bulk_insert_media,
            commands::db::media::bulk_update_media_category,
            commands::db::media::fetch_media_paths,
            commands::db::media::bulk_delete_media,
            commands::db::playlist::fetch_all_playlists,
            commands::db::playlist::create_playlist,
            commands::db::playlist::update_playlist,
            commands::db::playlist::delete_playlist,
            commands::db::playlist::fetch_playlist_cues,
            commands::db::playlist::fetch_playlist_meta,
            commands::db::playlist::add_cue_to_playlist,
            commands::db::playlist::update_playlist_sort_order,
            commands::db::playlist::remove_cue_from_playlist,
            commands::db::settings::get_db_setting,
            commands::db::settings::set_db_setting,
            commands::db::settings::set_core_workspace,
            commands::db::settings::get_core_workspace,
            commands::db::settings::check_and_acquire_lock,
            commands::db::settings::force_release_lock,
            commands::db::settings::is_db_offline,
            commands::db::shoot::fetch_shoot_slides,
            commands::db::shoot::fetch_all_shoots,
            commands::db::shoot::save_shoot,
            commands::db::shoot::delete_shoot,
            commands::db::shoot::fetch_shoot,
            commands::yt_downloader::download_youtube_video,
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
