// src/lib/db/index.ts
import Database from "@tauri-apps/plugin-sql";
import { systemState } from "$lib/state/system.svelte";
import { join } from "@tauri-apps/api/path";

let db: Database | null = null;

export async function initDB(workspacePath: string | null = null) {
  try {
    let dbPath = "sqlite:worshipcue.db";

    if (workspacePath) {
      const fullPath = await join(workspacePath, "worshipcue.db");
      dbPath = `sqlite://${fullPath}`;
      console.log(`[WorshipCuePro] Loading DB from Workspace: ${fullPath}`);
    } else {
      console.log("[WorshipCuePro] Loading DB from default local storage.");
    }

    if (db) {
      await db.close();
    }
    db = await Database.load(dbPath);

    // 1. Create Songs Table (UPDATED SCHEMA)
    await db.execute(`
            CREATE TABLE IF NOT EXISTS songs (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artist TEXT,
                lines_per_slide INTEGER DEFAULT 0,
                raw_lyrics TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

    await db.execute(`CREATE TRIGGER IF NOT EXISTS update_songs_timestamp
    AFTER UPDATE ON songs
    BEGIN
        UPDATE songs SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;`);

    await db.execute(`
            CREATE TABLE IF NOT EXISTS media (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                filepath TEXT NOT NULL,
                type TEXT NOT NULL,
                thumbnail_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

    await db.execute(`
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                service_date TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);

    await db.execute(`
            CREATE TABLE IF NOT EXISTS playlist_items (
                id TEXT PRIMARY KEY,
                playlist_id TEXT NOT NULL,
                item_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                sort_order INTEGER NOT NULL,
                FOREIGN KEY(playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );
        `);

    await db.execute(`
                CREATE TABLE IF NOT EXISTS bible_cache (
                    cache_key TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    timestamp INTEGER NOT NULL
                )
            `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS shoots (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await db.execute(`
        CREATE TABLE IF NOT EXISTS shoot_slides (
            id TEXT PRIMARY KEY,
            shoot_id TEXT REFERENCES shoots(id) ON DELETE CASCADE,
            media_id TEXT REFERENCES media(id) ON DELETE CASCADE,
            sort_order INTEGER NOT NULL
        );
    `);

    console.log("[WorshipCuePro] Database initialized successfully.");
    return true;
  } catch (error) {
    console.error("[WorshipCuePro] Database initialization failed:", error);
    systemState.addAlert({
      message: "Database failed to load. Check system logs.",
      type: "error",
    });
    return false;
  }
}

export function getDB() {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}
