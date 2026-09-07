use std::path::Path;

// /src-tauri/src/commands/db/shoot.rs
use crate::db::DbState;
use libsql::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Serialize, Deserialize)]
pub struct ShootMeta {
    pub id: String,
    pub title: String,
    #[serde(rename = "slideCount")]
    pub slide_count: i32,
    pub thumbnail_path: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct ShootSlideRow {
    pub id: String,
    pub media_id: Option<String>,
    pub filepath: Option<String>,
    pub media_type: Option<String>,
    pub sort_order: Option<i32>,
    pub text_content: Option<String>,
}

#[derive(Deserialize)]
pub struct SlideInsert {
    pub media_id: Option<String>, // Can be null if it's a text-only slide
    pub text_content: Option<String>,
}

#[derive(Serialize)]
pub struct FullShoot {
    pub id: String,
    pub title: String,
}

#[tauri::command]
pub async fn fetch_all_shoots(
    state: tauri::State<'_, crate::db::DbState>,
) -> Result<Vec<ShootMeta>, String> {
    let db_lock = state.lock().await;

    // Use a subquery to grab the filepath of the first associated media item
    let mut rows = db_lock
        .conn
        .query(
            "SELECT
                s.id,
                s.title,
                (SELECT COUNT(*) FROM shoot_slides WHERE shoot_id = s.id) as slide_count,
                (SELECT m.filepath
                 FROM shoot_slides ss
                 JOIN media m ON ss.media_id = m.id
                 WHERE ss.shoot_id = s.id AND m.filepath IS NOT NULL
                 ORDER BY ss.sort_order ASC
                 LIMIT 1) as thumbnail_path
             FROM shoots s
             ORDER BY s.created_at DESC",
            (),
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut shoots = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        shoots.push(ShootMeta {
            id: row.get(0).unwrap_or_default(),
            title: row.get(1).unwrap_or_default(),
            slide_count: row.get(2).unwrap_or(0),
            thumbnail_path: row.get(3).unwrap_or(None),
        });
    }

    Ok(shoots)
}

#[tauri::command]
pub async fn fetch_shoot_slides(
    state: State<'_, DbState>,
    shoot_id: String,
) -> Result<Vec<ShootSlideRow>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT ps.id, ps.media_id, m.filepath, m.type as media_type, ps.sort_order, ps.text_content
             FROM shoot_slides ps
             LEFT JOIN media m ON ps.media_id = m.id
             WHERE ps.shoot_id = ?1
             ORDER BY ps.sort_order ASC",
            params![shoot_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut slides = Vec::new();
    while let Ok(Some(row)) = rows.next().await {
        slides.push(ShootSlideRow {
            id: row.get(0).unwrap_or_default(),
            media_id: row.get(1).ok(),
            filepath: row.get(2).ok(),
            media_type: row.get(3).ok(),
            sort_order: row.get(4).ok(),
            text_content: row.get(5).ok(),
        });
    }

    Ok(slides)
}

#[tauri::command]
pub async fn save_shoot(
    state: State<'_, DbState>,
    id: String,
    title: String,
    slides: Vec<SlideInsert>,
) -> Result<(), String> {
    let db_lock = state.lock().await;

    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    // Check if shoot already exists
    let mut exist_rows = tx
        .query("SELECT id FROM shoots WHERE id = ?1", params![id.clone()])
        .await
        .map_err(|e| e.to_string())?;

    let existing = if let Ok(Some(_)) = exist_rows.next().await {
        true
    } else {
        false
    };

    if existing {
        tx.execute(
            "UPDATE shoots SET title = ?1 WHERE id = ?2",
            params![title, id.clone()],
        )
        .await
        .map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "INSERT INTO shoots (id, title) VALUES (?1, ?2)",
            params![id.clone(), title],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "DELETE FROM shoot_slides WHERE shoot_id = ?1",
        params![id.clone()],
    )
    .await
    .map_err(|e| e.to_string())?;

    for (i, slide) in slides.iter().enumerate() {
        let slide_id = uuid::Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO shoot_slides (id, shoot_id, media_id, sort_order, text_content) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                slide_id,
                id.clone(),
                slide.media_id.clone(),
                i as i32,
                slide.text_content.clone()
            ],
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_shoot(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let db_lock = state.lock().await;

    let tx = db_lock
        .conn
        .transaction()
        .await
        .map_err(|e| e.to_string())?;

    // 1. Find all media associated with this shoot that are specifically "Presentations"
    let mut rows = tx
        .query(
            "SELECT m.id, m.filepath FROM media m
         JOIN shoot_slides ss ON m.id = ss.media_id
         WHERE ss.shoot_id = ?1 AND m.category = 'Presentation'",
            params![id.clone()],
        )
        .await
        .map_err(|e| e.to_string())?;

    let mut media_ids = Vec::new();
    let mut filepaths = Vec::new();

    while let Ok(Some(row)) = rows.next().await {
        if let (Ok(m_id), Ok(f_path)) = (row.get::<String>(0), row.get::<String>(1)) {
            media_ids.push(m_id);
            filepaths.push(f_path);
        }
    }

    // 2. Delete the physical files from the drive
    let mut parent_dir_to_clean = None;
    for path_str in filepaths {
        let path = Path::new(&path_str);
        // Grab the directory path (e.g., presentations/Health Talk)
        if parent_dir_to_clean.is_none() {
            parent_dir_to_clean = path.parent().map(|p| p.to_path_buf());
        }
        // Delete the slide image
        let _ = std::fs::remove_file(path);
    }

    // 3. Try to clean up the presentation folder
    if let Some(dir) = parent_dir_to_clean {
        // remove_dir is safe: it automatically FAILS and does nothing if the folder is not empty
        let _ = std::fs::remove_dir(dir);
    }

    // 4. Delete the media records from the DB
    for m_id in media_ids {
        let _ = tx
            .execute("DELETE FROM media WHERE id = ?1", params![m_id])
            .await;
    }

    // 5. Delete the shoot slides & shoot records
    tx.execute(
        "DELETE FROM shoot_slides WHERE shoot_id = ?1",
        params![id.clone()],
    )
    .await
    .map_err(|e| e.to_string())?;

    tx.execute("DELETE FROM shoots WHERE id = ?1", params![id])
        .await
        .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn fetch_shoot(
    state: State<'_, DbState>,
    shoot_id: String,
) -> Result<Option<FullShoot>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT id, title FROM shoots WHERE id = ?1",
            params![shoot_id],
        )
        .await
        .map_err(|e| e.to_string())?;

    if let Ok(Some(row)) = rows.next().await {
        return Ok(Some(FullShoot {
            id: row.get(0).unwrap_or_default(),
            title: row.get(1).unwrap_or_default(),
        }));
    }

    Ok(None)
}
