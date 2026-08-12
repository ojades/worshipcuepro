// /src-tauri/src/commands/db/bible.rs
use crate::db::DbPool;
use serde::{Deserialize, Serialize};
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

#[derive(Deserialize)]
pub struct FtsVerseInsert {
    pub reference: String,
    pub text: String,
}

#[derive(Serialize)]
pub struct FtsSearchResult {
    pub reference: String,
    pub text: String,
    pub full_text: String,
}

#[tauri::command]
pub fn bulk_insert_bible_fts(
    pool: State<'_, DbPool>,
    version: String,
    verses: Vec<FtsVerseInsert>,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;

    // Using a transaction inserts the entire Bible in < 1 second
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let mut stmt = tx
            .prepare("INSERT INTO bible_fts (version, reference, text) VALUES (?1, ?2, ?3)")
            .map_err(|e| e.to_string())?;

        for verse in verses {
            stmt.execute((&version, &verse.reference, &verse.text))
                .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn search_bible_fts(
    pool: State<'_, DbPool>,
    _version: String,
    query_string: String,
    limit: i32,
) -> Result<Vec<FtsSearchResult>, String> {
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

    let fetch_limit = limit * 4;

    // Notice we REMOVED the `GROUP BY reference` here so snippet() works perfectly
    let mut stmt = conn
        .prepare(
            "SELECT
                reference,
                snippet(bible_fts, 2, '<mark class=\"bg-violet-900/60 text-violet-300 font-bold px-1 rounded\">', '</mark>', '...', 64),
                text
             FROM bible_fts
             WHERE bible_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(rusqlite::params![safe_query, fetch_limit], |row| {
            Ok(FtsSearchResult {
                reference: row.get(0)?,
                text: row.get(1)?,
                full_text: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    let mut seen_references = std::collections::HashSet::new();

    // Deduplicate in Rust: Keep only the highest-ranked result for each reference
    for item in iter {
        let res = item.map_err(|e| e.to_string())?;

        if !seen_references.contains(&res.reference) {
            seen_references.insert(res.reference.clone());
            results.push(res);

            // Stop once we hit the requested UI limit
            if results.len() as i32 >= limit {
                break;
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub fn delete_bible_fts_version(pool: State<'_, DbPool>, version: String) -> Result<(), String> {
    let conn = pool.get().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM bible_fts WHERE version = ?1", [&version])
        .map_err(|e| e.to_string())?;
    Ok(())
}
