// /src-tauri/src/db/mod.rs
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub type DbPool = r2d2::Pool<SqliteConnectionManager>;

#[derive(Serialize, Deserialize, Default)]
struct CoreConfig {
    workspace_path: Option<String>,
}

pub fn init_db(app_handle: &AppHandle) -> Result<DbPool, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| "Failed to resolve app data directory".to_string())?;

    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let config_path = app_dir.join("wcp_core.json");
    let db_dir = match fs::read_to_string(&config_path) {
        Ok(json) => {
            let config: CoreConfig = serde_json::from_str(&json).unwrap_or_default();
            config.workspace_path.map(PathBuf::from)
        }
        Err(_) => None,
    };

    let target_dir = db_dir.unwrap_or_else(|| app_dir.clone());

    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create workspace dir: {}", e))?;

    let db_path = target_dir.join("worshipcue.db");

    println!("[WorshipCuePro] Rust DB Engine mounting at: {:?}", db_path);

    let manager = SqliteConnectionManager::file(&db_path).with_init(|c| {
        c.execute_batch(
            "
                PRAGMA journal_mode = WAL;
                PRAGMA synchronous = NORMAL;
                PRAGMA busy_timeout = 5000;
                PRAGMA mmap_size = 268435456;
                PRAGMA cache_size = -20000;
                PRAGMA foreign_keys = ON;
                PRAGMA temp_store = MEMORY;
                ",
        )
    });

    let pool = r2d2::Pool::builder()
        .max_size(5)
        .build(manager)
        .map_err(|e| format!("Failed to create pool: {}", e))?;

    // 4. Run Schema Migrations
    run_migrations(&pool).map_err(|e| format!("Migration failed: {}", e))?;

    // 5. Run Silent Auto-Migrations for FTS
    auto_migrate_fts(&pool).map_err(|e| format!("FTS Auto-migration failed: {}", e))?;

    Ok(pool)
}

fn run_migrations(pool: &DbPool) -> Result<(), String> {
    // FIX: Remove unwrap, bubble the error gracefully
    let conn = pool
        .get()
        .map_err(|e| format!("Failed to connect to DB for migrations: {}", e))?;

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            artist TEXT,
            lines_per_slide INTEGER DEFAULT 0,
            raw_lyrics TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS media (
            id TEXT PRIMARY KEY,
            filename TEXT NOT NULL,
            filepath TEXT NOT NULL,
            type TEXT NOT NULL,
            thumbnail_path TEXT,
            category TEXT DEFAULT 'Uncategorized',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlists (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            service_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS playlist_items (
            id TEXT PRIMARY KEY,
            playlist_id TEXT NOT NULL,
            item_type TEXT NOT NULL,
            item_id TEXT NOT NULL,
            sort_order INTEGER NOT NULL,
            FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS bible_cache (
            cache_key TEXT PRIMARY KEY,
            data TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS shoots (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS shoot_slides (
            id TEXT PRIMARY KEY,
            shoot_id TEXT REFERENCES shoots(id) ON DELETE CASCADE,
            media_id TEXT REFERENCES media(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS bible_fts USING fts5(
            version UNINDEXED,   -- Don't index the version ID, just use it for filtering
            reference,
            text,
            tokenize='unicode61'
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
            id UNINDEXED,
            title,
            artist,
            raw_lyrics,
            tokenize='unicode61'
        );

        DROP TRIGGER IF EXISTS songs_ai;
        DROP TRIGGER IF EXISTS songs_ad;
        DROP TRIGGER IF EXISTS songs_au;

        CREATE TRIGGER songs_ai AFTER INSERT ON songs BEGIN
            INSERT INTO songs_fts(id, title, artist, raw_lyrics)
            VALUES (new.id, new.title, new.artist, new.raw_lyrics);
        END;

        CREATE TRIGGER songs_ad AFTER DELETE ON songs BEGIN
            DELETE FROM songs_fts WHERE id = old.id;
        END;

        CREATE TRIGGER songs_au AFTER UPDATE ON songs BEGIN
            UPDATE songs_fts
            SET title = new.title, artist = new.artist, raw_lyrics = new.raw_lyrics
            WHERE id = old.id;
        END;
        ",
    )
    .map_err(|e| format!("Execute batch failed: {}", e))?;

    let conn = pool.get().unwrap();
    let _ = conn.execute("ALTER TABLE shoot_slides ADD COLUMN text_content TEXT", []);

    Ok(())
}

fn auto_migrate_fts(pool: &DbPool) -> Result<(), String> {
    // FIX: Remove unwrap
    let mut conn = pool
        .get()
        .map_err(|e| format!("Failed to connect to DB for FTS migration: {}", e))?;

    let songs_fts_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM songs_fts", [], |r| r.get(0))
        .unwrap_or(0);
    let songs_count: i32 = conn
        .query_row("SELECT COUNT(*) FROM songs", [], |r| r.get(0))
        .unwrap_or(0);

    if songs_count > 0 && songs_fts_count == 0 {
        println!("[WorshipCuePro] Backfilling FTS index for Songs...");
        conn.execute(
            "INSERT INTO songs_fts(id, title, artist, raw_lyrics) SELECT id, title, artist, raw_lyrics FROM songs",
            []
        ).map_err(|e| e.to_string())?;
    }

    let versions_json: Option<String> = conn
        .query_row(
            "SELECT data FROM bible_cache WHERE cache_key = 'system_bible_versions'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let versions_json = match versions_json {
        Some(json) => json,
        None => return Ok(()),
    };

    let versions: Vec<serde_json::Value> = serde_json::from_str(&versions_json).unwrap_or_default();

    for v in versions {
        if let Some(version_id) = v.get("id").and_then(|id| id.as_str()) {
            let is_indexed: Option<i32> = conn
                .query_row(
                    "SELECT 1 FROM bible_fts WHERE version = ? LIMIT 1",
                    [version_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?;

            if is_indexed.is_none() {
                println!(
                    "[WorshipCuePro] Backfilling FTS index for existing Bible: {}",
                    version_id
                );

                let tx = conn.transaction().map_err(|e| e.to_string())?;

                let like_pattern = format!("verses_{}_%", version_id);
                let mut stmt = tx
                    .prepare("SELECT data FROM bible_cache WHERE cache_key LIKE ?")
                    .map_err(|e| e.to_string())?;

                let verse_arrays: Vec<String> = stmt
                    .query_map([&like_pattern], |row| row.get(0))
                    .map_err(|e| e.to_string())?
                    .filter_map(Result::ok)
                    .collect();

                let mut insert_stmt = tx
                    .prepare("INSERT INTO bible_fts (version, reference, text) VALUES (?, ?, ?)")
                    .map_err(|e| e.to_string())?;

                for arr_json in verse_arrays {
                    let verses: Vec<serde_json::Value> =
                        serde_json::from_str(&arr_json).unwrap_or_default();
                    for verse in verses {
                        if let (Some(reference), Some(text)) = (
                            verse.get("reference").and_then(|r| r.as_str()),
                            verse.get("text").and_then(|t| t.as_str()),
                        ) {
                            insert_stmt
                                .execute((version_id, reference, text))
                                .map_err(|e| e.to_string())?;
                        }
                    }
                }

                drop(insert_stmt);
                drop(stmt);
                tx.commit().map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}
