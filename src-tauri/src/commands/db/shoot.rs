// src-tauri/src/commands/db/shoot.rs
use crate::db::DbPool;
use rusqlite::OptionalExtension;
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
pub fn fetch_all_shoots(pool: State<'_, DbPool>) -> Result<Vec<ShootMeta>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT
                sh.id,
                sh.title,
                CAST(COUNT(ss.id) AS INTEGER) as slideCount
             FROM shoots sh
             LEFT JOIN shoot_slides ss ON sh.id = ss.shoot_id
             GROUP BY sh.id
             ORDER BY sh.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(ShootMeta {
                id: row.get(0)?,
                title: row.get(1)?,
                slide_count: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut shoots = Vec::new();
    for item in iter {
        shoots.push(item.map_err(|e| e.to_string())?);
    }
    Ok(shoots)
}

#[tauri::command]
pub fn fetch_shoot_slides(
    pool: State<'_, DbPool>,
    shoot_id: String,
) -> Result<Vec<ShootSlideRow>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT ps.id, ps.media_id, m.filepath, m.type as media_type, ps.sort_order, ps.text_content
             FROM shoot_slides ps
             LEFT JOIN media m ON ps.media_id = m.id
             WHERE ps.shoot_id = ?1
             ORDER BY ps.sort_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([&shoot_id], |row| {
            Ok(ShootSlideRow {
                id: row.get(0)?,
                media_id: row.get(1)?,
                filepath: row.get(2)?,
                media_type: row.get(3)?,
                sort_order: row.get(4)?,
                text_content: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut slides = Vec::new();
    for item in iter {
        slides.push(item.map_err(|e| e.to_string())?);
    }
    Ok(slides)
}

#[tauri::command]
pub fn save_shoot(
    pool: State<'_, DbPool>,
    id: String,
    title: String,
    slides: Vec<SlideInsert>,
) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        let existing: Option<String> = tx
            .query_row("SELECT id FROM shoots WHERE id = ?1", [&id], |row| {
                row.get(0)
            })
            .optional()
            .map_err(|e| e.to_string())?;

        if existing.is_some() {
            tx.execute("UPDATE shoots SET title = ?1 WHERE id = ?2", [&title, &id])
                .map_err(|e| e.to_string())?;
        } else {
            tx.execute(
                "INSERT INTO shoots (id, title) VALUES (?1, ?2)",
                [&id, &title],
            )
            .map_err(|e| e.to_string())?;
        }

        tx.execute("DELETE FROM shoot_slides WHERE shoot_id = ?1", [&id])
            .map_err(|e| e.to_string())?;

        // Include text_content in the insert
        let mut stmt = tx
            .prepare("INSERT INTO shoot_slides (id, shoot_id, media_id, sort_order, text_content) VALUES (?1, ?2, ?3, ?4, ?5)")
            .map_err(|e| e.to_string())?;

        for (i, slide) in slides.iter().enumerate() {
            let slide_id = uuid::Uuid::new_v4().to_string();
            stmt.execute((
                &slide_id,
                &id,
                &slide.media_id,
                &(i as i32),
                &slide.text_content,
            ))
            .map_err(|e| e.to_string())?;
        }
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_shoot(pool: State<'_, DbPool>, id: String) -> Result<(), String> {
    let mut conn = pool.get().map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    {
        tx.execute("DELETE FROM shoot_slides WHERE shoot_id = ?1", [&id])
            .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM shoots WHERE id = ?1", [&id])
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn fetch_shoot(pool: State<'_, DbPool>, shoot_id: String) -> Result<Option<FullShoot>, String> {
    let conn = pool.get().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, title FROM shoots WHERE id = ?1")
        .map_err(|e| e.to_string())?;

    let mut iter = stmt
        .query_map([&shoot_id], |row| {
            Ok(FullShoot {
                id: row.get(0)?,
                title: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(result) = iter.next() {
        return Ok(Some(result.map_err(|e| e.to_string())?));
    }

    Ok(None)
}
