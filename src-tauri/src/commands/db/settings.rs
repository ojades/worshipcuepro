// /src-tauri/src/commands/db/settings.rs
use crate::db::DbPool;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use tauri::Manager;
use tauri::State;

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

#[tauri::command]
pub fn check_and_acquire_lock(app_handle: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");

    let config_path = app_dir.join("wcp_core.json");

    let config: CoreConfig = match fs::read_to_string(&config_path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => CoreConfig::default(),
    };

    let media_dir = config
        .workspace_path
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_dir.clone());
    let db_dir = config
        .db_path
        .map(std::path::PathBuf::from)
        .unwrap_or(media_dir);

    let lock_path = db_dir.join("worshipcue.lock");

    if lock_path.exists() {
        // Locked! Read the name of the computer that locked it
        let owner =
            fs::read_to_string(&lock_path).unwrap_or_else(|_| "Another Operator".to_string());
        Ok(owner)
    } else {
        // Free! Create the lock file.
        // We write a simple timestamp/session marker so sync engines register the file change
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        let _ = fs::write(&lock_path, format!("Active Session ({})", timestamp));
        Ok("".to_string()) // Returning an empty string means "You successfully acquired the lock"
    }
}

#[tauri::command]
pub fn force_release_lock(app_handle: tauri::AppHandle) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");

    let config_path = app_dir.join("wcp_core.json");

    let config: CoreConfig = match fs::read_to_string(&config_path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => CoreConfig::default(),
    };

    let media_dir = config
        .workspace_path
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| app_dir.clone());
    let db_dir = config
        .db_path
        .map(std::path::PathBuf::from)
        .unwrap_or(media_dir);

    let lock_path = db_dir.join("worshipcue.lock");

    // Attempt to delete the lockfile silently
    let _ = fs::remove_file(lock_path);

    Ok(())
}
