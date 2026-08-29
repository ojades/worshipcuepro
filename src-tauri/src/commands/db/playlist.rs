// /src-tauri/src/commands/db/playlist.rs
use crate::db::DbState;
use libsql::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct PlaylistMeta {
    pub id: String,
    pub name: String,
    pub created_at: Option<String>,
    #[serde(rename = "cueCount")]
    pub cue_count: i32,
}

#[derive(Serialize, Deserialize)]
pub struct PlaylistCueRow {
    pub playlist_item_id: String,
    pub sort_order: i32,
    pub id: String,
    #[serde(rename = "type")]
    pub item_type: String,
    pub title: Option<String>,
    pub raw_lyrics: Option<String>,
    pub filepath: Option<String>,
    pub media_type: Option<String>,
}

#[derive(Deserialize)]
pub struct SortOrderItem {
    pub playlist_item_id: String,
    pub sort_order: i32,
}

#[tauri::command]
pub async fn fetch_all_playlists(state: State<'_, DbState>) -> Result<Vec<PlaylistMeta>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT
                p.id,
                p.name,
                p.created_at,
                CAST(COUNT(pi.id) AS INTEGER) as cue_count
             FROM playlists p
             LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
             GROUP BY p.id
             ORDER BY p.created_at DESC",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut playlists = Vec::new();

    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        playlists.push(PlaylistMeta {
            id: row.get(0).unwrap_or_default(),
            name: row.get(1).unwrap_or_default(),
            created_at: row.get(2).ok(),
            cue_count: row.get(3).unwrap_or(0),
        });
    }

    Ok(playlists)
}

#[tauri::command]
pub async fn create_playlist(
    state: State<'_, DbState>,
    id: String,
    title: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "INSERT INTO playlists (id, name) VALUES (?1, ?2)",
            params![id, title],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_playlist(
    state: State<'_, DbState>,
    id: String,
    new_title: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "UPDATE playlists SET name = ?1 WHERE id = ?2",
            params![new_title, id],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_playlist(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let db_lock = state.lock().await;

    // Transaction ensures both items and playlist are deleted together
    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    tx.execute(
        "DELETE FROM playlist_items WHERE playlist_id = ?1",
        params![id.clone()],
    )
    .await
    .map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM playlists WHERE id = ?1", params![id])
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn fetch_playlist_cues(
    state: State<'_, DbState>,
    playlist_id: String,
) -> Result<Vec<PlaylistCueRow>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT
                pi.id as playlist_item_id,
                pi.sort_order,
                pi.item_id as id,
                pi.item_type as type,
                COALESCE(s.title, m.filename, sh.title) as title,
                s.raw_lyrics,
                m.filepath,
                m.type as media_type
             FROM playlist_items pi
             LEFT JOIN songs s ON pi.item_id = s.id AND pi.item_type = 'song'
             LEFT JOIN media m ON pi.item_id = m.id AND pi.item_type = 'media'
             LEFT JOIN shoots sh ON pi.item_id = sh.id AND pi.item_type = 'shoot'
             WHERE pi.playlist_id = ?1
             ORDER BY pi.sort_order ASC",
            params![playlist_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut cues = Vec::new();

    while let Ok(Some(row)) = rows.next().await {
        cues.push(PlaylistCueRow {
            playlist_item_id: row.get(0).unwrap_or_default(),
            sort_order: row.get(1).unwrap_or(0),
            id: row.get(2).unwrap_or_default(),
            item_type: row.get(3).unwrap_or_default(),
            title: row.get(4).ok(),
            raw_lyrics: row.get(5).ok(),
            filepath: row.get(6).ok(),
            media_type: row.get(7).ok(),
        });
    }

    Ok(cues)
}

#[tauri::command]
pub async fn fetch_playlist_meta(
    state: State<'_, DbState>,
    playlist_id: String,
) -> Result<Option<PlaylistMeta>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT id, name, created_at FROM playlists WHERE id = ?1",
            params![playlist_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(Some(row)) = rows.next().await {
        return Ok(Some(PlaylistMeta {
            id: row.get(0).unwrap_or_default(),
            name: row.get(1).unwrap_or_default(),
            created_at: row.get(2).ok(),
            cue_count: 0, // Not needed for single fetch
        }));
    }

    Ok(None)
}

#[tauri::command]
pub async fn add_cue_to_playlist(
    state: tauri::State<'_, DbState>,
    playlist_id: String,
    item_id: String,
    item_type: String,
    playlist_item_id: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    // Scope block: fetch the count and immediately drop the read cursor
    let count: i32 = {
        let mut count_rows = db_lock
            .conn
            .query(
                "SELECT COUNT(id) FROM playlist_items WHERE playlist_id = ?1",
                libsql::params![playlist_id.clone()],
            )
            .await
            .map_err(|e| e.to_string())?;

        // Safely extract the count, ignoring transient read errors
        if let Some(row) = count_rows.next().await.unwrap_or(None) {
            row.get(0).unwrap_or(0)
        } else {
            0
        }
    };

    db_lock
        .conn
        .execute(
            "INSERT INTO playlist_items (id, playlist_id, item_id, item_type, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
            libsql::params![playlist_item_id, playlist_id, item_id, item_type, count],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_playlist_sort_order(
    state: State<'_, DbState>,
    updates: Vec<SortOrderItem>,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    // Batch process the updates using a transaction
    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    for update in updates {
        tx.execute(
            "UPDATE playlist_items SET sort_order = ?1 WHERE id = ?2",
            params![update.sort_order, update.playlist_item_id],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn remove_cue_from_playlist(
    state: State<'_, DbState>,
    playlist_item_id: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "DELETE FROM playlist_items WHERE id = ?1",
            params![playlist_item_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
