// /src-tauri/src/commands/db/playlist.rs
use crate::db::DbPool;
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
pub fn fetch_all_playlists(pool: State<'_, DbPool>) -> Result<Vec<PlaylistMeta>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT
                p.id,
                p.name,
                p.created_at,
                CAST(COUNT(pi.id) AS INTEGER) as cue_count
             FROM playlists p
             LEFT JOIN playlist_items pi ON p.id = pi.playlist_id
             GROUP BY p.id
             ORDER BY p.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(PlaylistMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                cue_count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut playlists = Vec::new();
    for item in iter {
        playlists.push(item.map_err(|e| e.to_string())?);
    }
    Ok(playlists)
}

#[tauri::command]
pub fn create_playlist(pool: State<'_, DbPool>, id: String, title: String) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO playlists (id, name) VALUES (?1, ?2)",
        [&id, &title],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_playlist(
    pool: State<'_, DbPool>,
    id: String,
    new_title: String,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE playlists SET name = ?1 WHERE id = ?2",
        [&new_title, &id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_playlist(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    // Transaction ensures both items and playlist are deleted together or neither are
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        tx.execute("DELETE FROM playlist_items WHERE playlist_id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM playlists WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn fetch_playlist_cues(
    pool: State<'_, DbPool>,
    playlist_id: String,
) -> Result<Vec<PlaylistCueRow>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
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
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([&playlist_id], |row| {
            Ok(PlaylistCueRow {
                playlist_item_id: row.get(0)?,
                sort_order: row.get(1)?,
                id: row.get(2)?,
                item_type: row.get(3)?,
                title: row.get(4)?,
                raw_lyrics: row.get(5)?,
                filepath: row.get(6)?,
                media_type: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut cues = Vec::new();
    for item in iter {
        cues.push(item.map_err(|e| e.to_string())?);
    }
    Ok(cues)
}

#[tauri::command]
pub fn fetch_playlist_meta(
    pool: State<'_, DbPool>,
    playlist_id: String,
) -> Result<Option<PlaylistMeta>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, created_at FROM playlists WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut iter = stmt
        .query_map([&playlist_id], |row| {
            Ok(PlaylistMeta {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
                cue_count: 0, // Not needed for single fetch
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(result) = iter.next() {
        return Ok(Some(result.map_err(|e| e.to_string())?));
    }
    Ok(None)
}

#[tauri::command]
pub fn add_cue_to_playlist(
    pool: State<'_, DbPool>,
    playlist_id: String,
    item_id: String,
    item_type: String,
    playlist_item_id: String,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    // Fetch current count to determine sort_order
    let count: i32 = conn
        .query_row(
            "SELECT COUNT(id) FROM playlist_items WHERE playlist_id = ?1",
            [&playlist_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO playlist_items (id, playlist_id, item_id, item_type, sort_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        (
            &playlist_item_id,
            &playlist_id,
            &item_id,
            &item_type,
            &count,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_playlist_sort_order(
    pool: State<'_, DbPool>,
    updates: Vec<SortOrderItem>,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;
    // Batch process the updates incredibly fast
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("UPDATE playlist_items SET sort_order = ?1 WHERE id = ?2")
            .map_err(|e| e.to_string())?;

        for update in updates {
            stmt.execute([&update.sort_order.to_string(), &update.playlist_item_id])
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn remove_cue_from_playlist(
    pool: State<'_, DbPool>,
    playlist_item_id: String,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM playlist_items WHERE id = ?1",
        [&playlist_item_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
