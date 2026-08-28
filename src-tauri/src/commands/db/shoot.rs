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
pub async fn fetch_all_shoots(state: State<'_, DbState>) -> Result<Vec<ShootMeta>, String> {
    let db_lock = state.lock().await;

    let mut rows = db_lock
        .conn
        .query(
            "SELECT
                sh.id,
                sh.title,
                CAST(COUNT(ss.id) AS INTEGER) as slideCount
             FROM shoots sh
             LEFT JOIN shoot_slides ss ON sh.id = ss.shoot_id
             GROUP BY sh.id
             ORDER BY sh.created_at DESC",
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
