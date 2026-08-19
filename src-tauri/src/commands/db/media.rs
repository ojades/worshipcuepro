// /src-tauri/src/commands/db/media.rs
use crate::db::DbPool;
use serde::{Deserialize, Serialize};
use tauri::State;
use tokio::fs;

#[derive(Serialize, Deserialize)]
pub struct MediaRow {
    pub id: String,
    pub filename: String,
    pub filepath: String,
    #[serde(rename = "type")]
    pub media_type: String, // 'type' is a reserved keyword in Rust
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
pub fn fetch_all_media(pool: State<'_, DbPool>) -> Result<Vec<MediaRow>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, filename, filepath, type, category, thumbnail_path, created_at FROM media ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(MediaRow {
                id: row.get(0)?,
                filename: row.get(1)?,
                filepath: row.get(2)?,
                media_type: row.get(3)?,
                category: row.get(4)?,
                thumbnail_path: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut media = Vec::new();
    for item in iter {
        media.push(item.map_err(|e| e.to_string())?);
    }

    Ok(media)
}

#[tauri::command]
pub fn update_category_by_name(
    pool: State<'_, DbPool>,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE media SET category = ?1 WHERE category = ?2",
        [&new_name, &old_name],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_media_thumbnail(
    pool: State<'_, DbPool>,
    id: String,
    thumbnail_path: String,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE media SET thumbnail_path = ?1 WHERE id = ?2",
        [&thumbnail_path, &id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn bulk_insert_media(pool: State<'_, DbPool>, items: Vec<MediaInsert>) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;

    // Transactions are vastly faster for bulk inserts
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("INSERT INTO media (id, filename, filepath, type, category) VALUES (?1, ?2, ?3, ?4, ?5)")
            .map_err(|e| e.to_string())?;

        for item in items {
            stmt.execute((
                &item.id,
                &item.filename,
                &item.filepath,
                &item.media_type,
                &item.category,
            ))
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn bulk_update_media_category(
    pool: State<'_, DbPool>,
    ids: Vec<String>,
    new_category: String,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("UPDATE media SET category = ?1 WHERE id = ?2")
            .map_err(|e| e.to_string())?;
        for id in ids {
            stmt.execute([&new_category, &id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn fetch_media_paths(
    pool: State<'_, DbPool>,
    ids: Vec<String>,
) -> Result<Vec<MediaPaths>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    // Build parameterized IN clause string: "?, ?, ?"
    let placeholders = vec!["?"; ids.len()].join(", ");
    let query = format!(
        "SELECT filepath, thumbnail_path FROM media WHERE id IN ({})",
        placeholders
    );

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(rusqlite::params_from_iter(ids.iter()), |row| {
            Ok(MediaPaths {
                filepath: row.get(0)?,
                thumbnail_path: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut paths = Vec::new();
    for p in iter {
        paths.push(p.map_err(|e| e.to_string())?);
    }
    Ok(paths)
}

#[tauri::command]
pub fn bulk_delete_media(pool: State<'_, DbPool>, ids: Vec<String>) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("DELETE FROM media WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        for id in ids {
            stmt.execute([&id]).map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
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
