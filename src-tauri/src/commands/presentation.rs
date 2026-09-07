use image::{imageops, RgbaImage};
use pdfium_render::prelude::*;
use std::process::Command;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn convert_pdf_to_slides(
    app_handle: AppHandle,
    pdf_path: String,
    output_dir: String,
) -> Result<Vec<String>, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|_| "Failed to find resource directory".to_string())?
        .join("binaries");

    let resource_dir_str = resource_dir.to_string_lossy().to_string();
    let pdfium_path = Pdfium::pdfium_platform_library_name_at_path(&resource_dir_str);

    let pdfium = Pdfium::new(
        Pdfium::bind_to_library(&pdfium_path)
            .or_else(|_| Pdfium::bind_to_system_library())
            .map_err(|e| format!("Failed to bind PDFium: {}", e))?,
    );

    let document = pdfium
        .load_pdf_from_file(&pdf_path, None)
        .map_err(|e| e.to_string())?;

    let mut generated_images = Vec::new();
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;

    // The standard 16:9 4K canvas size
    let canvas_w = 3840;
    let canvas_h = 2160;
    let target_w = canvas_w as f32;
    let target_h = canvas_h as f32;

    for (index, page) in document.pages().iter().enumerate() {
        // 1. Get the actual PDF page dimensions
        let page_width = page.width().value;
        let page_height = page.height().value;

        // 2. Calculate the scale to fit INSIDE the 16:9 canvas without cropping
        let scale = f32::min(target_w / page_width, target_h / page_height);
        let render_w = (page_width * scale).round() as u32;
        let render_h = (page_height * scale).round() as u32;

        // 3. Render the page to the exact scaled size
        let render_config = PdfRenderConfig::new()
            .set_target_width(render_w as i32)
            .set_target_height(render_h as i32);

        let bitmap = page
            .render_with_config(&render_config)
            .map_err(|e| format!("Failed to render page {}: {}", index, e))?;

        let fg = bitmap
            .as_image()
            .map_err(|e| format!("Failed to convert bitmap to image: {}", e))?;

        // 4. Create a blank 3840x2160 canvas (Transparent)
        let mut bg = RgbaImage::new(canvas_w, canvas_h);

        // 5. Calculate offsets to place the page perfectly in the center
        let x_offset = (canvas_w.saturating_sub(render_w)) / 2;
        let y_offset = (canvas_h.saturating_sub(render_h)) / 2;

        // 6. Overlay the page onto the canvas
        imageops::overlay(&mut bg, &fg, x_offset as i64, y_offset as i64);

        let image_path = format!("{}/slide_{}.png", output_dir, index + 1);

        // 7. Save the standardized 16:9 image
        bg.save_with_format(&image_path, image::ImageFormat::Png)
            .map_err(|e| format!("Failed to save PNG: {}", e))?;

        generated_images.push(image_path);
    }

    Ok(generated_images)
}

#[tauri::command]
pub async fn convert_pptx_to_pdf(input_pptx: String, output_dir: String) -> Result<String, String> {
    // --- WINDOWS: Use Native PowerPoint COM API ---
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "$pp = New-Object -ComObject PowerPoint.Application; \
             $pres = $pp.Presentations.Open('{}', [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse); \
             $pres.SaveAs('{}', 17); \
             $pres.Close(); \
             $pp.Quit();",
            input_pptx, output_dir
        );

        let output = Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("PowerShell failed to start: {}", e))?;

        if output.status.success() {
            return Ok(format!("{}/presentation.pdf", output_dir));
        } else {
            return Err(String::from_utf8_lossy(&output.stderr).to_string());
        }
    }

    // --- MAC / LINUX: Fallback to Headless LibreOffice ---
    #[cfg(not(target_os = "windows"))]
    {
        // On macOS, LibreOffice is usually installed in Applications
        let soffice_path = if cfg!(target_os = "macos") {
            "/Applications/LibreOffice.app/Contents/MacOS/soffice"
        } else {
            "soffice" // Linux usually has it in PATH
        };

        let output = Command::new(soffice_path)
            .args([
                "--headless",
                "--convert-to",
                "pdf",
                &input_pptx,
                "--outdir",
                &output_dir,
            ])
            .output()
            .map_err(|e| {
                format!(
                    "Failed to start LibreOffice (make sure it's installed): {}",
                    e
                )
            })?;

        if output.status.success() {
            // LibreOffice saves the PDF with the same base name as the PPTX
            let path = std::path::Path::new(&input_pptx);
            let file_stem = path.file_stem().unwrap_or_default().to_string_lossy();
            Ok(format!("{}/{}.pdf", output_dir, file_stem))
        } else {
            Err(String::from_utf8_lossy(&output.stderr).to_string())
        }
    }
}

#[tauri::command]
pub async fn download_google_slides_pdf(
    presentation_id: String,
    save_path: String,
) -> Result<String, String> {
    let export_url = format!(
        "https://docs.google.com/presentation/d/{}/export/pdf",
        presentation_id
    );

    let bytes = reqwest::get(&export_url)
        .await
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    std::fs::write(&save_path, bytes).map_err(|e| e.to_string())?;
    Ok(save_path)
}
