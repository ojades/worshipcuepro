// /src-tauri/src/commands/db/settings.rs
use crate::db::DbPool;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use tauri::Manager;
use tauri::State;

pub static OWNS_LOCK: AtomicBool = AtomicBool::new(false);

#[derive(Serialize, Deserialize, Default)]
struct CoreConfig {
    workspace_path: Option<String>,
    db_path: Option<String>,
}

#[tauri::command]
pub fn get_db_setting(pool: State<'_, DbPool>, key: String) -> Result<Option<String>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1 LIMIT 1")
        .map_err(|e| e.to_string())?;

    let mut iter = stmt
        .query_map([&key], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    if let Some(result) = iter.next() {
        return Ok(Some(result.map_err(|e| e.to_string())?));
    }

    Ok(None)
}

#[tauri::command]
pub fn set_db_setting(pool: State<'_, DbPool>, key: String, value: String) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [&key, &value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn set_core_workspace(
    app_handle: tauri::AppHandle,
    path: String,
    db_path: Option<String>,
) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");

    let config_path = app_dir.join("wcp_core.json");

    let config = CoreConfig {
        workspace_path: Some(path),
        db_path, // NEW
    };

    let json = serde_json::to_string(&config).map_err(|e| e.to_string())?;

    fs::write(config_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_core_workspace(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");

    let config_path = app_dir.join("wcp_core.json");

    match fs::read_to_string(&config_path) {
        Ok(json) => {
            let config: CoreConfig = serde_json::from_str(&json).unwrap_or_default();
            Ok(config.workspace_path)
        }
        Err(_) => Ok(None),
    }
}

fn get_session_id() -> &'static str {
    static SESSION_ID: OnceLock<String> = OnceLock::new();
    SESSION_ID.get_or_init(|| {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis();

        let pid = std::process::id();

        // Check for macOS/Linux (USER) or Windows (USERNAME) environment variables
        let user = std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .unwrap_or_else(|_| "Unknown Operator".to_string());

        // Check for Windows (COMPUTERNAME) or macOS/Linux (HOSTNAME) environment variables
        let host = std::env::var("COMPUTERNAME")
            .or_else(|_| std::env::var("HOSTNAME"))
            .unwrap_or_else(|_| {
                // If environment variables fail (common on macOS GUI apps), ask the OS directly
                std::process::Command::new("hostname")
                    .output()
                    .ok()
                    .filter(|out| out.status.success())
                    .and_then(|out| String::from_utf8(out.stdout).ok())
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "Unknown PC".to_string())
            });

        // Construct a highly readable identity string
        format!("{} on {} (ID: {}_{})", user, host, timestamp, pid)
    })
}

#[tauri::command]
pub fn check_and_acquire_lock(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle.path().app_data_dir().unwrap();
    let config_path = app_dir.join("wcp_core.json");
    let config: CoreConfig = fs::read_to_string(&config_path)
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default();

    let media_dir = config
        .workspace_path
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_dir.clone());
    let db_dir = config
        .db_path
        .map(std::path::PathBuf::from)
        .unwrap_or(media_dir);
    let lock_path = db_dir.join("worshipcue.lock");

    let my_session = get_session_id();

    if lock_path.exists() {
        let owner = fs::read_to_string(&lock_path).unwrap_or_default();

        // Check if WE are the ones who wrote this file
        if owner == my_session {
            OWNS_LOCK.store(true, Ordering::SeqCst);
            Ok("".to_string()) // Returning empty string means "You are editing"
        } else {
            // Someone else (or a cloud sync) owns this file
            OWNS_LOCK.store(false, Ordering::SeqCst);
            let display_owner = if owner.is_empty() {
                "Another Operator".to_string()
            } else {
                owner
            };
            Ok(display_owner)
        }
    } else {
        // Free! Create the lock file and write our unique ID into it
        OWNS_LOCK.store(true, Ordering::SeqCst);
        let _ = fs::write(&lock_path, my_session);
        Ok("".to_string())
    }
}

#[tauri::command]
pub fn force_release_lock(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_dir = app_handle.path().app_data_dir().unwrap();
    let config_path = app_dir.join("wcp_core.json");
    let config: CoreConfig = fs::read_to_string(&config_path)
        .ok()
        .and_then(|json| serde_json::from_str(&json).ok())
        .unwrap_or_default();

    let media_dir = config
        .workspace_path
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_dir.clone());
    let db_dir = config
        .db_path
        .map(std::path::PathBuf::from)
        .unwrap_or(media_dir);

    // FIX: Unconditionally delete the lockfile so the Override button works
    let _ = fs::remove_file(db_dir.join("worshipcue.lock"));

    Ok(())
}

// Safe exit function that only deletes the lock if we truly own it
pub fn release_lock_on_exit(app_handle: &tauri::AppHandle) {
    if OWNS_LOCK.load(Ordering::SeqCst) {
        if let Ok(app_dir) = app_handle.path().app_data_dir() {
            let config_path = app_dir.join("wcp_core.json");
            if let Ok(json) = fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<CoreConfig>(&json) {
                    let media_dir = config
                        .workspace_path
                        .map(std::path::PathBuf::from)
                        .unwrap_or_else(|| app_dir.clone());
                    let db_dir = config
                        .db_path
                        .map(std::path::PathBuf::from)
                        .unwrap_or(media_dir);

                    let lock_path = db_dir.join("worshipcue.lock");

                    // Double check that a cloud sync didn't steal it right before we closed
                    if let Ok(content) = fs::read_to_string(&lock_path) {
                        if content == get_session_id() {
                            let _ = fs::remove_file(lock_path);
                        }
                    }
                }
            }
        }
    }
}
