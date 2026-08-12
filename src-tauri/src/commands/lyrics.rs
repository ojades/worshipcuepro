use reqwest::Client;
use scraper::{Html, Selector};
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct GeniusSearchResult {
    pub id: u32,
    pub title: String,
    pub artist: String,
    pub url: String,
    pub image_url: String,
}

// --- Genius API JSON Structures ---
#[derive(Deserialize)]
struct GeniusSearchResponse {
    response: GeniusResponseData,
}

#[derive(Deserialize)]
struct GeniusResponseData {
    hits: Vec<GeniusHit>,
}

#[derive(Deserialize)]
struct GeniusHit {
    result: GeniusResult,
}

#[derive(Deserialize)]
struct GeniusResult {
    id: u32,
    title: String,
    artist_names: String,
    url: String,
    header_image_thumbnail_url: String,
}

/// Command 1: Search the Genius API to get song URLs
#[tauri::command]
pub async fn search_genius(
    query: String,
    api_key: String,
) -> Result<Vec<GeniusSearchResult>, String> {
    let client = Client::new();

    let res = client
        .get("https://api.genius.com/search")
        .query(&[("q", query)])
        .bearer_auth(api_key)
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let data: GeniusSearchResponse = res
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Map the nested JSON into our clean struct
    let results = data
        .response
        .hits
        .into_iter()
        .map(|hit| GeniusSearchResult {
            id: hit.result.id,
            title: hit.result.title,
            artist: hit.result.artist_names,
            url: hit.result.url,
            image_url: hit.result.header_image_thumbnail_url,
        })
        .collect();

    Ok(results)
}

/// Command 2: Scrape the actual lyrics from the Genius webpage URL
#[tauri::command]
pub async fn scrape_genius_lyrics(url: String) -> Result<String, String> {
    let client = Client::new();

    // Genius (and Cloudflare) often block requests without a standard User-Agent.
    let res = client
        .get(&url)
        .header(
            "User-Agent",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let html = res
        .text()
        .await
        .map_err(|e| format!("Failed to read HTML: {}", e))?;

    let document = Html::parse_document(&html);

    // Genius houses lyrics in divs with `data-lyrics-container="true"`
    let selector = Selector::parse("div[data-lyrics-container=\"true\"]").unwrap();

    let mut lyrics = String::new();

    // Iterate through all lyric blocks
    for container in document.select(&selector) {
        // Iterate through EVERY sub-node (text, links, bold tags, etc.)
        for node in container.descendants() {
            if let Some(text) = node.value().as_text() {
                // Genius sometimes injects zero-width spaces; we clean them out
                lyrics.push_str(&text.replace('\u{200B}', ""));
            } else if let Some(element) = node.value().as_element() {
                // Manually map <br> tags to actual newline characters
                if element.name() == "br" {
                    lyrics.push('\n');
                }
            }
        }
        // Add a double newline at the end of each stanza block
        lyrics.push_str("\n\n");
    }

    // Clean up any excessive line breaks and return
    let cleaned = lyrics.replace("\n\n\n", "\n\n");
    Ok(cleaned.trim().to_string())
}
