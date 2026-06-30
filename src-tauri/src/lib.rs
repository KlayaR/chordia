use std::fs;

use serde::Serialize;

#[derive(Serialize)]
struct DragPaths {
    file: String,
    icon: String,
}

/// Write `bytes` to a temp file named `filename` and return its path, along
/// with a drag-preview icon path. The frontend then hands `file` to the OS
/// drag operation (tauri-plugin-drag) so it lands in a DAW as a real file.
#[tauri::command]
fn save_drag_file(filename: String, bytes: Vec<u8>) -> Result<DragPaths, String> {
    let mut dir = std::env::temp_dir();
    dir.push("Chordia");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    // strip any path separators so a crafted name can't escape the temp dir
    let safe: String = filename
        .chars()
        .map(|c| if c == '/' || c == '\\' || c == ':' { '_' } else { c })
        .collect();
    let safe = if safe.is_empty() { "chordia.mid".to_string() } else { safe };

    let file_path = dir.join(&safe);
    fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    // drag-preview image, written once
    let icon_path = dir.join("_drag_icon.png");
    if !icon_path.exists() {
        let icon_bytes = include_bytes!("../icons/32x32.png");
        fs::write(&icon_path, icon_bytes).map_err(|e| e.to_string())?;
    }

    Ok(DragPaths {
        file: file_path.to_string_lossy().into_owned(),
        icon: icon_path.to_string_lossy().into_owned(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_drag::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![save_drag_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
