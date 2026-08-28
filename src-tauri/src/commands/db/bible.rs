// /src-tauri/src/commands/db/bible.rs
use crate::db::DbState;
use libsql::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize)]
pub struct BibleCacheEntry {
    pub data: String,
    pub timestamp: i64,
}

#[tauri::command]
pub async fn get_bible_cache(
    state: State<'_, DbState>,
    key: String,
) -> Result<Option<BibleCacheEntry>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT data, timestamp FROM bible_cache WHERE cache_key = ?1",
            params![key],
        )
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(Some(row)) = rows.next().await {
        let data: String = row.get(0).map_err(|e| e.to_string())?;
        let timestamp: i64 = row.get(1).map_err(|e| e.to_string())?;

        return Ok(Some(BibleCacheEntry { data, timestamp }));
    }

    Ok(None)
}

#[tauri::command]
pub async fn set_bible_cache(
    state: State<'_, DbState>,
    key: String,
    data: String,
    timestamp: i64,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute(
            "INSERT OR REPLACE INTO bible_cache (cache_key, data, timestamp) VALUES (?1, ?2, ?3)",
            params![key, data, timestamp],
        )
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_bible_cache(state: State<'_, DbState>, key: String) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute("DELETE FROM bible_cache WHERE cache_key = ?1", params![key])
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn clear_bible_cache(state: State<'_, DbState>) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute("DELETE FROM bible_cache", ())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_system_bible_cache(
    state: State<'_, DbState>,
    prefixed_id: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    // Construct the SQL LIKE patterns natively in Rust
    let imported_key = format!("imported_{}", prefixed_id);
    let books_key = format!("books_{}", prefixed_id);
    let chapters_like = format!("chapters_{}_%", prefixed_id);
    let verses_like = format!("verses_{}_%", prefixed_id);

    db_lock
        .conn
        .execute(
            "DELETE FROM bible_cache WHERE cache_key = ?1 OR cache_key = ?2 OR cache_key LIKE ?3 OR cache_key LIKE ?4",
            params![imported_key, books_key, chapters_like, verses_like],
        )
        .await
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
pub async fn bulk_insert_bible_fts(
    state: State<'_, DbState>,
    version: String,
    verses: Vec<FtsVerseInsert>,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    // Using an async transaction inserts the entire Bible efficiently
    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    for verse in verses {
        tx.execute(
            "INSERT INTO bible_fts (version, reference, text) VALUES (?1, ?2, ?3)",
            params![version.clone(), verse.reference, verse.text],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn search_bible_fts(
    state: State<'_, DbState>,
    _version: String,
    query_string: String,
    limit: i32,
) -> Result<Vec<FtsSearchResult>, String> {
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
    let db_lock = state.lock().await;

    // Notice we REMOVED the `GROUP BY reference` here so snippet() works perfectly
    let mut rows = db_lock
        .conn
        .query(
            "SELECT
                reference,
                snippet(bible_fts, 2, '<mark class=\"bg-violet-900/60 text-violet-300 font-bold px-1 rounded\">', '</mark>', '...', 64),
                text
             FROM bible_fts
             WHERE bible_fts MATCH ?1
             ORDER BY rank
             LIMIT ?2",
            params![safe_query, fetch_limit as i64],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    let mut seen_references = std::collections::HashSet::new();

    // Deduplicate in Rust: Keep only the highest-ranked result for each reference
    while let Ok(Some(row)) = rows.next().await {
        let reference: String = row.get(0).unwrap_or_default();
        let text: String = row.get(1).unwrap_or_default();
        let full_text: String = row.get(2).unwrap_or_default();

        if !seen_references.contains(&reference) {
            seen_references.insert(reference.clone());

            results.push(FtsSearchResult {
                reference,
                text,
                full_text,
            });

            // Stop once we hit the requested UI limit
            if results.len() as i32 >= limit {
                break;
            }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn delete_bible_fts_version(
    state: State<'_, DbState>,
    version: String,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    db_lock
        .conn
        .execute("DELETE FROM bible_fts WHERE version = ?1", params![version])
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
