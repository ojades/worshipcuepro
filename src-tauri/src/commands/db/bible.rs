// /src-tauri/src/commands/db/bible.rs
use crate::db::DbPool;
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct BibleCacheEntry {
    pub data: String,
    pub timestamp: i64,
}

#[tauri::command]
pub fn get_bible_cache(
    pool: State<'_, DbPool>,
    key: String,
) -> Result<Option<BibleCacheEntry>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT data, timestamp FROM bible_cache WHERE cache_key = ?1")
        .map_err(|e| e.to_string())?;

    let mut iter = stmt
        .query_map([&key], |row| {
            Ok(BibleCacheEntry {
                data: row.get(0)?,
                timestamp: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(result) = iter.next() {
        return Ok(Some(result.map_err(|e| e.to_string())?));
    }

    Ok(None)
}

#[tauri::command]
pub fn set_bible_cache(
    pool: State<'_, DbPool>,
    key: String,
    data: String,
    timestamp: i64,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO bible_cache (cache_key, data, timestamp) VALUES (?1, ?2, ?3)",
        (&key, &data, &timestamp),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_bible_cache(pool: State<'_, DbPool>, key: String) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM bible_cache WHERE cache_key = ?1", [&key])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn clear_bible_cache(pool: State<'_, DbPool>) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM bible_cache", [])
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_system_bible_cache(
    pool: State<'_, DbPool>,
    prefixed_id: String,
) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    // Construct the SQL LIKE patterns natively in Rust
    let imported_key = format!("imported_{}", prefixed_id);
    let books_key = format!("books_{}", prefixed_id);
    let chapters_like = format!("chapters_{}_%", prefixed_id);
    let verses_like = format!("verses_{}_%", prefixed_id);

    conn.execute(
        "DELETE FROM bible_cache WHERE cache_key = ?1 OR cache_key = ?2 OR cache_key LIKE ?3 OR cache_key LIKE ?4",
        (&imported_key, &books_key, &chapters_like, &verses_like),
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
