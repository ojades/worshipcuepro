// /src-tauri/src/commands/db/song.rs
use crate::db::DbPool;
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
pub fn fetch_all_songs(pool: State<'_, DbPool>) -> Result<Vec<Song>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, title, artist, lines_per_slide, raw_lyrics, created_at, updated_at FROM songs ORDER BY title ASC")
        .map_err(|e| e.to_string())?;

    let song_iter = stmt
        .query_map([], |row| {
            Ok(Song {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                lines_per_slide: row.get(3)?,
                raw_lyrics: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut songs = Vec::new();
    for song in song_iter {
        songs.push(song.map_err(|e| e.to_string())?);
    }

    Ok(songs)
}

#[tauri::command]
pub fn insert_song(pool: State<'_, DbPool>, data: SongInput) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO songs (id, title, artist, lines_per_slide, raw_lyrics) VALUES (?1, ?2, ?3, ?4, ?5)",
        (
            &data.id,
            &data.title,
            &data.artist,
            &data.lines_per_slide,
            &data.raw_lyrics,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_song(pool: State<'_, DbPool>, data: SongInput) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE songs SET title = ?1, artist = ?2, lines_per_slide = ?3, raw_lyrics = ?4 WHERE id = ?5",
        (
            &data.title,
            &data.artist,
            &data.lines_per_slide,
            &data.raw_lyrics,
            &data.id,
        ),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_song(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM songs WHERE id = ?1", [&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn sync_checkpoint(pool: State<'_, DbPool>) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE);", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn search_songs_fts(
    pool: State<'_, DbPool>,
    query_string: String,
    limit: i32,
) -> Result<Vec<SongSearchResult>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

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

    // snippet() pulls from column index 3 (raw_lyrics) to highlight where the phrase matched
    let mut stmt = conn
        .prepare(
            "SELECT
                id,
                title,
                artist,
                snippet(songs_fts, 3, '<mark class=\"bg-violet-900/60 text-violet-300 font-bold px-1 rounded\">', '</mark>', '...', 15)
             FROM songs_fts
             WHERE songs_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(rusqlite::params![safe_query, limit], |row| {
            Ok(SongSearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                artist: row.get(2)?,
                lyrics_snippet: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for item in iter {
        results.push(item.map_err(|e| e.to_string())?);
    }

    Ok(results)
}
