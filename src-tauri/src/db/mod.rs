// /src-tauri/src/db/mod.rs
use r2d2_sqlite::SqliteConnectionManager;
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
        .expect("Failed to resolve app data directory");

    fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;

    // 1. Read the core config to find the workspace
    let config_path = app_dir.join("wcp_core.json");
    let mut db_dir = match fs::read_to_string(&config_path) {
        Ok(json) => {
            let config: CoreConfig = serde_json::from_str(&json).unwrap_or_default();
            config.workspace_path.map(PathBuf::from)
        }
        Err(_) => None,
    };

    // 2. If no workspace is set, default to Documents/WorshipCuePro
    if db_dir.is_none() {
        let docs_dir = app_handle
            .path()
            .document_dir()
            .expect("Failed to resolve documents dir");
        let default_workspace = docs_dir.join("WorshipCuePro");
        db_dir = Some(default_workspace);
    }

    let target_dir = db_dir.unwrap();
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    // 3. Mount the database in the target Workspace
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

    run_migrations(&pool).map_err(|e| format!("Migration failed: {}", e))?;

    Ok(pool)
}

fn run_migrations(pool: &DbPool) -> rusqlite::Result<()> {
    let conn = pool.get().unwrap();

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
        ",
    )?;
    Ok(())
}
