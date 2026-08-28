// /src-tauri/src/db/mod.rs
use libsql::{Builder, Connection, Database};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

pub struct AppDb {
    pub db: Arc<Database>,
    pub conn: Connection,
    pub is_offline: Arc<AtomicBool>,
}

pub type DbState = Arc<Mutex<AppDb>>;

#[derive(Serialize, Deserialize, Default)]
struct CoreConfig {
    workspace_path: Option<String>,
    db_path: Option<String>,
    turso_url: Option<String>,
    turso_token: Option<String>,
}

pub async fn init_db(app_handle: &AppHandle) -> Result<DbState, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|_| "Failed to resolve app data directory".to_string())?;

    fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let config_path = app_dir.join("wcp_core.json");
    let config: CoreConfig = match fs::read_to_string(&config_path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => CoreConfig::default(),
    };

    let media_dir = config
        .workspace_path
        .map(PathBuf::from)
        .unwrap_or_else(|| app_dir.clone());

    let db_dir = config
        .db_path
        .map(PathBuf::from)
        .unwrap_or_else(|| media_dir.clone());

    fs::create_dir_all(&media_dir).unwrap_or_default();
    fs::create_dir_all(&db_dir).map_err(|e| format!("Failed to create DB dir: {}", e))?;

    let mut db_opt: Option<Arc<Database>> = None;
    let is_offline_flag = Arc::new(AtomicBool::new(false));

    // --- FAULT-TOLERANT ENGINE ROUTER ---
    if let (Some(mut url), Some(token)) = (config.turso_url, config.turso_token) {
        if !url.trim().is_empty() && !token.trim().is_empty() {
            if url.starts_with("turso://") {
                url = url.replace("turso://", "libsql://");
            }

            println!("[WorshipCuePro] Attempting Turso Cloud Sync Engine boot...");
            let replica_path = db_dir.join("wcp_replica.db");

            match Builder::new_remote_replica(replica_path, url, token)
                .build()
                .await
            {
                Ok(raw_db) => {
                    let db_arc = Arc::new(raw_db);
                    db_opt = Some(Arc::clone(&db_arc));

                    let sync_offline_flag = Arc::clone(&is_offline_flag);

                    // Try initial handshake, but DO NOT abort if offline!
                    println!("[Turso] Performing initial sync handshake with primary server...");
                    if let Err(e) = db_arc.sync().await {
                        eprintln!(
                            "[Turso] Initial handshake failed, starting in OFFLINE mode. Error: {}",
                            e
                        );
                        sync_offline_flag.store(true, Ordering::SeqCst);
                    } else {
                        println!("[Turso] Initial handshake successful!");
                    }

                    // Always launch the continuous sync loop. This allows the app to automatically
                    // recover from offline mode when Wi-Fi is restored.
                    let sync_db = Arc::clone(&db_arc);
                    tauri::async_runtime::spawn(async move {
                        tokio::time::sleep(Duration::from_secs(10)).await;
                        loop {
                            if let Err(e) = sync_db.sync().await {
                                let err_msg = e.to_string();
                                if !err_msg.contains("database is locked")
                                    && !err_msg.contains("wal_insert_begin")
                                {
                                    // Set offline and log only if we weren't already offline
                                    if !sync_offline_flag.load(Ordering::SeqCst) {
                                        sync_offline_flag.store(true, Ordering::SeqCst);
                                        eprintln!("[Turso] Network drop detected: {}", err_msg);
                                    }
                                }
                            } else {
                                // Sync succeeded! Clear offline flag if it was true.
                                if sync_offline_flag.load(Ordering::SeqCst) {
                                    sync_offline_flag.store(false, Ordering::SeqCst);
                                    println!(
                                        "[Turso] Network restored! Synced to cloud successfully."
                                    );
                                }
                            }
                            tokio::time::sleep(Duration::from_secs(15)).await;
                        }
                    });
                }
                Err(e) => {
                    eprintln!("[Turso] Failed to initialize replica builder: {}. Falling back to Local SQLite.", e);
                }
            }
        }
    }

    // --- LOCAL FALLBACK ---
    let db = if let Some(d) = db_opt {
        d // Turso builder succeeded (online or offline)
    } else {
        // Only trigger this if Turso is totally unconfigured or the builder fatally crashed
        println!("[WorshipCuePro] Booting Local SQLite Engine...");
        let local_path = db_dir.join("worshipcue.db");

        let raw_db = Builder::new_local(local_path)
            .build()
            .await
            .map_err(|e| format!("Failed to build local DB: {}", e))?;

        Arc::new(raw_db)
    };

    // --- SELF-HEALING CONNECTION ---
    let conn = match db.connect() {
        Ok(c) => c,
        Err(e) => {
            let err_str = e.to_string();
            if err_str.contains("file is not a database")
                || err_str.contains("database disk image is malformed")
            {
                let replica_path = db_dir.join("wcp_replica.db");
                if replica_path.exists() {
                    let _ = std::fs::remove_file(&replica_path);
                    return Err("Corrupted local sync file detected and automatically cleared. Please restart the app.".to_string());
                }
            }
            return Err(format!("Failed to connect: {}", err_str));
        }
    };

    // Apply performance pragmas
    let _ = conn
        .execute_batch(
            "
            PRAGMA busy_timeout = 5000;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
        ",
        )
        .await;

    if let Err(e) = run_migrations(&conn).await {
        eprintln!("[WorshipCuePro] Migration warning: {}", e);
    }

    if let Err(e) = auto_migrate_fts(&conn).await {
        eprintln!("[WorshipCuePro] FTS auto-migration warning: {}", e);
    }

    let app_db = Arc::new(Mutex::new(AppDb {
        db,
        conn,
        is_offline: is_offline_flag,
    }));
    Ok(app_db)
}

async fn run_migrations(conn: &Connection) -> Result<(), String> {
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
            version UNINDEXED,
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
    .await
    .map_err(|e| format!("Execute batch failed: {}", e))?;

    let _ = conn
        .execute("ALTER TABLE shoot_slides ADD COLUMN text_content TEXT", ())
        .await;

    Ok(())
}

async fn auto_migrate_fts(conn: &Connection) -> Result<(), String> {
    let mut fts_rows = conn
        .query("SELECT COUNT(*) FROM songs_fts", ())
        .await
        .map_err(|e| e.to_string())?;
    let songs_fts_count: i32 = if let Ok(Some(row)) = fts_rows.next().await {
        row.get(0).unwrap_or(0)
    } else {
        0
    };

    let mut songs_rows = conn
        .query("SELECT COUNT(*) FROM songs", ())
        .await
        .map_err(|e| e.to_string())?;
    let songs_count: i32 = if let Ok(Some(row)) = songs_rows.next().await {
        row.get(0).unwrap_or(0)
    } else {
        0
    };

    if songs_count > 0 && songs_fts_count == 0 {
        println!("[WorshipCuePro] Backfilling FTS index for Songs...");
        let _ = conn.execute("INSERT INTO songs_fts(id, title, artist, raw_lyrics) SELECT id, title, artist, raw_lyrics FROM songs", ()).await;
    }

    let mut cache_rows = conn
        .query(
            "SELECT data FROM bible_cache WHERE cache_key = 'system_bible_versions'",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;
    let versions_json: Option<String> = if let Ok(Some(row)) = cache_rows.next().await {
        row.get(0).ok()
    } else {
        None
    };

    let versions_json = match versions_json {
        Some(json) => json,
        None => return Ok(()),
    };

    let versions: Vec<serde_json::Value> = serde_json::from_str(&versions_json).unwrap_or_default();

    for v in versions {
        if let Some(version_id) = v.get("id").and_then(|id| id.as_str()) {
            let mut check_rows = conn
                .query(
                    "SELECT 1 FROM bible_fts WHERE version = ?1 LIMIT 1",
                    libsql::params![version_id],
                )
                .await
                .map_err(|e| e.to_string())?;
            let is_indexed: Option<i32> = if let Ok(Some(row)) = check_rows.next().await {
                row.get(0).ok()
            } else {
                None
            };

            if is_indexed.is_none() {
                println!(
                    "[WorshipCuePro] Backfilling FTS index for existing Bible: {}",
                    version_id
                );

                let like_pattern = format!("verses_{}_%", version_id);
                let mut verse_arrays: Vec<String> = Vec::new();

                if let Ok(mut verse_rows) = conn
                    .query(
                        "SELECT data FROM bible_cache WHERE cache_key LIKE ?1",
                        libsql::params![like_pattern],
                    )
                    .await
                {
                    while let Ok(Some(row)) = verse_rows.next().await {
                        if let Ok(data) = row.get(0) {
                            verse_arrays.push(data);
                        }
                    }
                }

                let mut count = 0;
                let chunk_size = 250;
                let mut current_tx = conn.transaction().await.ok();

                for arr_json in verse_arrays {
                    let verses: Vec<serde_json::Value> =
                        serde_json::from_str(&arr_json).unwrap_or_default();
                    for verse in verses {
                        if let (Some(reference), Some(text)) = (
                            verse.get("reference").and_then(|r| r.as_str()),
                            verse.get("text").and_then(|t| t.as_str()),
                        ) {
                            if let Some(tx) = &current_tx {
                                let _ = tx.execute(
                                    "INSERT INTO bible_fts (version, reference, text) VALUES (?1, ?2, ?3)",
                                    libsql::params![version_id, reference, text]
                                ).await;
                            }

                            count += 1;
                            if count % chunk_size == 0 {
                                if let Some(tx) = current_tx {
                                    let _ = tx.commit().await;
                                }
                                current_tx = conn.transaction().await.ok();
                                println!(
                                    "[WorshipCuePro] FTS Backfill progress: {} verses indexed...",
                                    count
                                );
                            }
                        }
                    }
                }

                if let Some(tx) = current_tx {
                    let _ = tx.commit().await;
                    println!(
                        "[WorshipCuePro] FTS Backfill for {} completed! ({} total verses).",
                        version_id, count
                    );
                }
            }
        }
    }

    Ok(())
}
