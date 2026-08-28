// /src-tauri/src/commands/db/song.rs
use crate::db::DbState;
use libsql::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct Song {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub lines_per_slide: Option<i32>,
    pub raw_lyrics: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Deserialize)]
pub struct SongInput {
    pub id: String,
    pub title: String,
    pub artist: String,
    pub lines_per_slide: i32,
    pub raw_lyrics: String,
}

#[derive(Serialize)]
pub struct SongSearchResult {
    pub id: String,
    pub title: String,
    pub artist: Option<String>,
    pub lyrics_snippet: Option<String>,
}

#[tauri::command]
pub async fn fetch_all_songs(state: State<'_, DbState>) -> Result<Vec<Song>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT id, title, artist, lines_per_slide, raw_lyrics, created_at, updated_at FROM songs ORDER BY title ASC",
            ()
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut songs = Vec::new();
    while let Some(row) = rows.next().await.map_err(|e| e.to_string())? {
        songs.push(Song {
            id: row.get(0).unwrap_or_default(),
            title: row.get(1).unwrap_or_default(),
            artist: row.get(2).ok(),
            lines_per_slide: row.get(3).ok(),
            raw_lyrics: row.get(4).ok(),
            created_at: row.get(5).ok(),
            updated_at: row.get(6).ok(),
        });
    }

    Ok(songs)
}

#[tauri::command]
pub async fn insert_song(state: State<'_, DbState>, data: SongInput) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "INSERT INTO songs (id, title, artist, lines_per_slide, raw_lyrics) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                data.id,
                data.title,
                data.artist,
                data.lines_per_slide,
                data.raw_lyrics
            ],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn update_song(state: State<'_, DbState>, data: SongInput) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "UPDATE songs SET title = ?1, artist = ?2, lines_per_slide = ?3, raw_lyrics = ?4 WHERE id = ?5",
            params![
                data.title,
                data.artist,
                data.lines_per_slide,
                data.raw_lyrics,
                data.id
            ],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_song(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute("DELETE FROM songs WHERE id = ?1", params![id])
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn sync_checkpoint(state: State<'_, DbState>) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute("PRAGMA wal_checkpoint(TRUNCATE);", ())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn search_songs_fts(
    state: State<'_, DbState>,
    query_string: String,
    limit: i32,
) -> Result<Vec<SongSearchResult>, String> {
    let safe_query = query_string
        .replace("\"", "")
        .replace("'", "")
        .split_whitespace()
        .map(|s| format!("{}*", s))
        .collect::<Vec<_>>()
        .join(" ");

    if safe_query.is_empty() {
        return Ok(Vec::new());
    }

    let db_lock = state.lock().await;

    // snippet() pulls from column index 3 (raw_lyrics) to highlight where the phrase matched
    let mut rows = db_lock
        .conn
        .query(
            "SELECT
                id,
                title,
                artist,
                snippet(songs_fts, 3, '<mark class=\"bg-violet-900/60 text-violet-300 font-bold px-1 rounded\">', '</mark>', '...', 15)
             FROM songs_fts
             WHERE songs_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
            params![safe_query, limit],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        results.push(SongSearchResult {
            id: row.get(0).unwrap_or_default(),
            title: row.get(1).unwrap_or_default(),
            artist: row.get(2).ok(),
            lyrics_snippet: row.get(3).ok(),
        });
    }

    Ok(results)
}
