use tokio::fs;

#[tauri::command]
pub async fn bulk_copy_media(files: Vec<(String, String)>) -> Result<(), String> {
    let mut handles = vec![];

    // Spawn a separate async task for every file so they copy simultaneously
    for (src, dest) in files {
        handles.push(tokio::spawn(async move {
            fs::copy(&src, &dest)
                .await
                .map_err(|e| format!("Failed to copy {}: {}", src, e))
        }));
    }

    // Wait for all files to finish copying
    for handle in handles {
        handle.await.map_err(|e| e.to_string())??;
    }

    Ok(())
}
