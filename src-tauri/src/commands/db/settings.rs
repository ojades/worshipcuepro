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
pub fn set_core_workspace(app_handle: tauri::AppHandle, path: String) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to resolve app data directory");

    let config_path = app_dir.join("wcp_core.json");

    // FIX: Safely serialize using serde instead of manual string formatting
    let config = CoreConfig {
        workspace_path: Some(path),
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
