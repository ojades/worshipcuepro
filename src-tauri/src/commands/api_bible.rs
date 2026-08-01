// /src-tauri/src/commands/api_bible.rs
use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use tauri::State;

// Pulls the key at compile-time. If missing, it becomes None.
const API_BIBLE_KEY: Option<&str> = option_env!("API_BIBLE_KEY");
const API_BIBLE_BASE: &str = "https://api.scripture.api.bible/v1";

// Wrapper for Tauri Managed State
pub struct ApiHttpClient(pub Client);

// Helper function to handle standard fetch requests securely
async fn fetch_api_bible(client: &Client, endpoint: &str) -> Result<Value, String> {
    let api_key = API_BIBLE_KEY.ok_or(
        "API.Bible key is missing at build time. Please configure your environment variables.",
    )?;

    let url = format!("{}{}", API_BIBLE_BASE, endpoint);

    let res = client
        .get(&url)
        .header("api-key", api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("Bible API Error: {}", res.status()));
    }

    let json: Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // api.bible wraps the actual payload inside a "data" object
    Ok(json["data"].clone())
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_bible_versions(client: State<'_, ApiHttpClient>) -> Result<Value, String> {
    fetch_api_bible(&client.inner().0, "/bibles?language=eng").await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_bible_books(
    client: State<'_, ApiHttpClient>,
    bible_id: String,
) -> Result<Value, String> {
    fetch_api_bible(&client.inner().0, &format!("/bibles/{}/books", bible_id)).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_bible_chapters(
    client: State<'_, ApiHttpClient>,
    bible_id: String,
    book_id: String,
) -> Result<Value, String> {
    fetch_api_bible(
        &client.inner().0,
        &format!("/bibles/{}/books/{}/chapters", bible_id, book_id),
    )
    .await
}

// Struct to pass both results back to Svelte for parsing
#[derive(Serialize)]
pub struct VersesResponse {
    pub verses: Value,
    pub chapter_html: String,
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_bible_verses(
    client: State<'_, ApiHttpClient>,
    bible_id: String,
    chapter_id: String,
) -> Result<VersesResponse, String> {
    let verses_endpoint = format!("/bibles/{}/chapters/{}/verses", bible_id, chapter_id);
    let chapter_endpoint = format!(
        "/bibles/{}/chapters/{}?content-type=html&include-verse-spans=true",
        bible_id, chapter_id
    );

    // Initialize parallel futures
    let verses_future = fetch_api_bible(&client.inner().0, &verses_endpoint);
    let chapter_future = fetch_api_bible(&client.inner().0, &chapter_endpoint);

    // Run both requests concurrently, identical to Promise.all
    let (verses_res, chapter_res) = tokio::join!(verses_future, chapter_future);

    let verses = verses_res?;
    let chapter_data = chapter_res?;

    // Extract the HTML string safely
    let chapter_html = chapter_data["content"].as_str().unwrap_or("").to_string();

    Ok(VersesResponse {
        verses,
        chapter_html,
    })
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_bible_verse_text(
    client: State<'_, ApiHttpClient>,
    bible_id: String,
    verse_id: String,
) -> Result<Value, String> {
    fetch_api_bible(
        &client.inner().0,
        &format!("/bibles/{}/verses/{}?content-type=json", bible_id, verse_id),
    )
    .await
}
