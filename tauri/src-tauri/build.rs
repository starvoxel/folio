fn main() {
    // Deny by default: the app's own commands are only callable if a capability grants them.
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(
            tauri_build::AppManifest::new().commands(&["get_config", "load_data", "quit_app", "open_csv_dialog"]),
        ),
    )
    .expect("failed to run tauri-build");
}
