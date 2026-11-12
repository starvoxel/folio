// placeholder; filled in later
use tauri::AppHandle;
#[tauri::command]
pub fn open_csv_dialog(_app: AppHandle) -> Result<Option<String>, String> { Ok(None) }
pub fn setup(_app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> { Ok(()) }
