use futures_util::StreamExt;
use reqwest::Client;
use rusty_ytdl::Video;
use std::path::PathBuf;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;

#[tauri::command]
pub async fn download_youtube_video(url: String, workspace_path: String) -> Result<String, String> {
    // 1. Fetch the raw metadata
    let basic_video = Video::new(&url).map_err(|e| format!("Failed to parse URL: {}", e))?;
    let info = basic_video
        .get_info()
        .await
        .map_err(|e| format!("Failed to get info: {}", e))?;

    let safe_title = info
        .video_details
        .title
        .replace(|c: char| !c.is_alphanumeric() && c != ' ', "")
        .replace(" ", "_");

    let unique_id = Uuid::new_v4()
        .to_string()
        .chars()
        .take(6)
        .collect::<String>();
    let filename = format!("{}-{}.mp4", safe_title, unique_id);

    let mut path = PathBuf::from(workspace_path);
    path.push("media");
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    path.push(&filename);

    // 2. Clone the formats and sort them by height (resolution) descending
    let mut formats = info.formats.clone();
    formats.sort_by(|a, b| b.height.unwrap_or(0).cmp(&a.height.unwrap_or(0)));

    let mut target_format = None;

    // PASS 1: Try to find a high-quality .mp4 with BOTH Video and Audio
    for f in &formats {
        // Fix: Explicitly check the `container` field of the MimeType struct
        if f.has_video && f.has_audio && f.mime_type.container.contains("mp4") {
            target_format = Some(f);
            break;
        }
    }

    // PASS 2: Accept ANY format with BOTH Video and Audio
    if target_format.is_none() {
        for f in &formats {
            if f.has_video && f.has_audio {
                target_format = Some(f);
                break;
            }
        }
    }

    // PASS 3: Fallback to an .mp4 with Video ONLY
    if target_format.is_none() {
        for f in &formats {
            if f.has_video && f.mime_type.container.contains("mp4") {
                target_format = Some(f);
                break;
            }
        }
    }

    // PASS 4: Absolute last resort - just give us ANYTHING with a moving picture
    if target_format.is_none() {
        for f in &formats {
            if f.has_video {
                target_format = Some(f);
                break;
            }
        }
    }

    let download_url = match target_format {
        Some(f) => f.url.clone(),
        None => {
            // Fix: Map to the container string to bubble up the error cleanly
            let mimes: Vec<String> = formats.into_iter().map(|f| f.mime_type.container).collect();
            return Err(format!(
                "No playable streams found. Available formats: {:?}",
                mimes
            ));
        }
    };

    // 3. Bypass the crate and download the stream directly using Reqwest
    let client = Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")

            .use_rustls_tls()
            .build()
            .map_err(|e| e.to_string())?;

    // Inject strict media-player headers to completely bypass YouTube's 403 bot-detection
    let response = client
        .get(&download_url)
        .header(reqwest::header::REFERER, "https://www.youtube.com/")
        .header(reqwest::header::ORIGIN, "https://www.youtube.com")
        .header(reqwest::header::ACCEPT, "*/*")
        .header("Sec-Fetch-Dest", "video")
        .header("Sec-Fetch-Mode", "cors")
        .header("Sec-Fetch-Site", "cross-site")
        .header("Range", "bytes=0-")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "YouTube rejected the download stream: HTTP {}",
            response.status()
        ));
    }

    // 4. Stream the bytes asynchronously to the disk
    let mut file = File::create(&path).await.map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
    }

    Ok(filename)
}
