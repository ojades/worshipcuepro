// /src-tauri/src/commands/db/media.rs
use crate::db::DbState;
use libsql::{params, Value};
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::fs;

#[derive(Serialize, Deserialize)]
pub struct MediaRow {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub category: String,
    pub thumbnail_path: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Deserialize)]
pub struct MediaInsert {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    #[serde(rename = "type")]
    pub media_type: String,
    pub category: String,
}

#[derive(Serialize)]
pub struct MediaPaths {
    pub filepath: String,
    pub thumbnail_path: Option<String>,
}

#[tauri::command]
pub async fn fetch_all_media(state: State<'_, DbState>) -> Result<Vec<MediaRow>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT id, filename, filepath, type, category, thumbnail_path, created_at FROM media ORDER BY created_at DESC",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut media = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        media.push(MediaRow {
            id: row.get(0).unwrap_or_default(),
            filename: row.get(1).unwrap_or_default(),
            filepath: row.get(2).unwrap_or_default(),
            media_type: row.get(3).unwrap_or_default(),
            category: row.get(4).unwrap_or_default(),
            thumbnail_path: row.get(5).ok(),
            created_at: row.get(6).ok(),
        });
    }

    Ok(media)
}

#[tauri::command]
pub async fn update_category_by_name(
    state: State<'_, DbState>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "UPDATE media SET category = ?1 WHERE category = ?2",
            params![new_name, old_name],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_media_thumbnail(
    state: State<'_, DbState>,
    id: String,
    thumbnail_path: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "UPDATE media SET thumbnail_path = ?1 WHERE id = ?2",
            params![thumbnail_path, id],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn bulk_insert_media(
    state: State<'_, DbState>,
    items: Vec<MediaInsert>,
) -> Result<(), String> {
    let db_lock = state.lock().await;
    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    for item in items {
        tx.execute(
            "INSERT INTO media (id, filename, filepath, type, category) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                item.id,
                item.filename,
                item.filepath,
                item.media_type,
                item.category
            ],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn bulk_update_media_category(
    state: State<'_, DbState>,
    ids: Vec<String>,
    new_category: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;
    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    for id in ids {
        tx.execute(
            "UPDATE media SET category = ?1 WHERE id = ?2",
            params![new_category.clone(), id],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn fetch_media_paths(
    state: State<'_, DbState>,
    ids: Vec<String>,
) -> Result<Vec<MediaPaths>, String> {
    if ids.is_empty() {
        return Ok(Vec::new());
    }

    let db_lock = state.lock().await;

    let placeholders = vec!["?"; ids.len()].join(", ");
    let query = format!(
        "SELECT filepath, thumbnail_path FROM media WHERE id IN ({})",
        placeholders
    );

    // Convert Vec<String> into Vec<libsql::Value>
    let param_values: Vec<Value> = ids.into_iter().map(|id| Value::Text(id)).collect();

    let mut rows = db_lock
        .conn
        .query(&query, param_values)
        .await
        .map_err(|e| e.to_string())?;

    let mut paths = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        paths.push(MediaPaths {
            filepath: row.get(0).unwrap_or_default(),
            thumbnail_path: row.get(1).ok(),
        });
    }

    Ok(paths)
}

#[tauri::command]
pub async fn bulk_delete_media(state: State<'_, DbState>, ids: Vec<String>) -> Result<(), String> {
    let db_lock = state.lock().await;
    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    for id in ids {
        tx.execute("DELETE FROM media WHERE id = ?1", params![id])
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn bulk_copy_media(files: Vec<(String, String)>) -> Result<(), String> {
    let mut handles = vec![];
    for (src, dest) in files {
        handles.push(tokio::spawn(async move {
            fs::copy(&src, &dest)
                .await
                .map_err(|e| format!("Failed to copy {}: {}", src, e))
        }));
    }
    for handle in handles {
        handle.await.map_err(|e| e.to_string())??;
    }
    Ok(())
}
