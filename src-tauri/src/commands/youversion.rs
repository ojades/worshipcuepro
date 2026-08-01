// /src-tauri/src/commands/youversion.rs
use crate::commands::api_bible::ApiHttpClient;
use serde_json::Value;
use tauri::State;

// Pulls the key at compile-time using the environment variable you defined in .cargo/config.toml
const YOUVERSION_API_KEY: Option<&str> = option_env!("YOUVERSION_API_KEY");
const YV_API_BASE: &str = "https://api.youversion.com/v1";

// Helper function to handle standard fetch requests securely
async fn fetch_youversion(client: &reqwest::Client, endpoint: &str) -> Result<Value, String> {
    let api_key = YOUVERSION_API_KEY.ok_or(
        "YouVersion App Key is missing at build time. Please configure your environment variables.",
    )?;

    let url = format!("{}{}", YV_API_BASE, endpoint);

    let res = client
        .get(&url)
        .header("X-YVP-App-Key", api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_body = res.text().await.unwrap_or_default();
        return Err(format!("YouVersion API Error: {} - {}", status, error_body));
    }

    let mut json: Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Mimic the JS `return data.data || data;` logic safely in Rust
    if let Some(data) = json.get_mut("data") {
        Ok(data.take())
    } else {
        Ok(json)
    }
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_youversion_versions(client: State<'_, ApiHttpClient>) -> Result<Value, String> {
    fetch_youversion(&client.inner().0, "/bibles?language_ranges[]=eng").await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_youversion_index(
    client: State<'_, ApiHttpClient>,
    bible_id: String,
) -> Result<Value, String> {
    fetch_youversion(&client.inner().0, &format!("/bibles/{}/index", bible_id)).await
}

#[tauri::command(rename_all = "camelCase")]
pub async fn get_youversion_verses(
    client: State<'_, ApiHttpClient>,
    bible_id: String,
    passage_id: String,
) -> Result<Value, String> {
    fetch_youversion(
        &client.inner().0,
        &format!("/bibles/{}/passages/{}", bible_id, passage_id),
    )
    .await
}
