//! Folio Tauri shell. Four commands, nothing else: no fs plugin, no shell, no http, no updater.

use std::path::PathBuf;
use tauri::ipc::Response;

#[cfg(feature = "extras")]
pub mod extras;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    file_name: &'static str,
    automation: bool,
    platform: &'static str,
}

/// Automation (the test/agent state hook and, in test builds, the WebDriver server) is off unless the
/// process was started with FOLIO_AUTOMATION=1. Nothing in the renderer can turn it on.
fn automation_requested() -> bool {
    std::env::var("FOLIO_AUTOMATION").map(|v| v == "1").unwrap_or(false)
}

fn data_dir() -> Result<PathBuf, String> {
    let from_arg = std::env::args().find_map(|a| a.strip_prefix("--data-dir=").map(str::to_owned));
    let dir = from_arg
        .or_else(|| std::env::var("FOLIO_DATA_DIR").ok())
        .ok_or("No data directory: pass --data-dir=<path> or set FOLIO_DATA_DIR")?;
    Ok(PathBuf::from(dir))
}

#[tauri::command]
fn get_config() -> AppConfig {
    AppConfig {
        file_name: "Household 2026.folio",
        automation: automation_requested(),
        platform: std::env::consts::OS,
    }
}

/// Reads exactly three fixed file names from the configured directory. The renderer passes no path.
#[tauri::command]
fn load_data() -> Result<Response, String> {
    let dir = data_dir()?;
    let read = |name: &str| std::fs::read_to_string(dir.join(name)).map_err(|e| format!("{name}: {e}"));
    let (a, c, t) = (read("accounts.json")?, read("categories.json")?, read("transactions.json")?);
    let mut out = String::with_capacity(a.len() + c.len() + t.len() + 64);
    out.push_str("{\"accounts\":");
    out.push_str(&a);
    out.push_str(",\"categories\":");
    out.push_str(&c);
    out.push_str(",\"transactions\":");
    out.push_str(&t);
    out.push('}');
    Ok(Response::new(out.into_bytes()))
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg(not(feature = "extras"))]
#[tauri::command]
fn open_csv_dialog() -> Result<Option<String>, String> {
    Err("not built into this binary".into())
}
#[cfg(feature = "extras")]
use extras::open_csv_dialog;

pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(feature = "automation")]
    {
        // Test builds only. The plugins open a local WebDriver server, so they are registered only when asked for.
        if automation_requested() {
            builder = builder.plugin(tauri_plugin_wdio::init()).plugin(tauri_plugin_wdio_webdriver::init());
        }
    }

    #[cfg(feature = "extras")]
    {
        builder = builder.plugin(tauri_plugin_dialog::init()).setup(extras::setup);
    }

    builder
        .invoke_handler(tauri::generate_handler![get_config, load_data, quit_app, open_csv_dialog])
        .run(tauri::generate_context!())
        .expect("error while running Folio");
}
