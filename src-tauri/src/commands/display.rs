// /src-tauri/src/commands/display.rs
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Serialize)]
pub struct DisplayInfo {
    name: String,
    is_primary: bool,
    width: u32,
    height: u32,
}

/// Returns a list of all connected displays with their resolution and primary status.
#[tauri::command]
pub fn get_displays(app: AppHandle) -> Result<Vec<DisplayInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let primary = app.primary_monitor().map_err(|e| e.to_string())?;
    let primary_name = primary.as_ref().and_then(|p| p.name().map(String::from));

    let mut displays = Vec::new();
    for monitor in monitors {
        let name = monitor
            .name()
            .cloned()
            .unwrap_or_else(|| "Unknown_Display".to_string());

        let is_primary = Some(&name) == primary_name.as_ref();
        let size = monitor.size();

        displays.push(DisplayInfo {
            name,
            is_primary: is_primary,
            width: size.width,
            height: size.height,
        });
    }

    Ok(displays)
}

/// Launches the Main Projector on the specified monitor.
#[tauri::command]
pub async fn launch_projector(app: AppHandle, monitor_name: Option<String>) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;

    // Find the specific monitor, or fallback to primary if not found/provided
    let target_monitor = if let Some(name) = monitor_name {
        monitors
            .into_iter()
            .find(|m| m.name() == Some(&name))
            .or_else(|| app.primary_monitor().ok().flatten())
    } else {
        app.primary_monitor().map_err(|e| e.to_string())?
    };

    let mut builder = WebviewWindowBuilder::new(
        &app,
        "projector_window",
        WebviewUrl::App("projector".into()),
    )
    .title("WorshipCuePro Projector")
    .decorations(false)
    .fullscreen(true)
    .always_on_top(true);

    // Move the window to the exact coordinates of the target monitor before building
    if let Some(monitor) = &target_monitor {
        let pos = monitor.position();
        builder = builder.position(pos.x as f64, pos.y as f64);
    }

    // Build the window directly into its fullscreen state
    builder.build().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_projector(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("projector_window") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn is_projector_open(app: AppHandle) -> bool {
    app.get_webview_window("projector_window").is_some()
}

/// Launches the Stage Display on the specified monitor.
#[tauri::command]
pub async fn launch_stage(app: AppHandle, monitor_name: Option<String>) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;

    let target_monitor = if let Some(name) = monitor_name {
        monitors
            .into_iter()
            .find(|m| m.name() == Some(&name))
            .or_else(|| app.primary_monitor().ok().flatten())
    } else {
        app.primary_monitor().map_err(|e| e.to_string())?
    };

    let mut builder =
        WebviewWindowBuilder::new(&app, "stage_window", WebviewUrl::App("stage".into()))
            .title("WorshipCuePro Stage Display")
            .decorations(false);

    if let Some(monitor) = &target_monitor {
        let pos = monitor.position();
        builder = builder.position(pos.x as f64, pos.y as f64);
    }

    let window = builder.build().map_err(|e| e.to_string())?;
    window.set_fullscreen(true).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn close_stage(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("stage_window") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn is_stage_open(app: AppHandle) -> bool {
    app.get_webview_window("stage_window").is_some()
}
