# Effort log (Tauri slice)

Times are UTC, 2026-11-12. Prompts or corrections from the user after the kickoff prompt: 0 so far.

- Start: read specs and Electron results. Sandbox is Ubuntu 24.04 with apt and crates.io access, so Tauri builds locally.
- Dispatched 3 read-only research agents (wry settings, WebView2/bundler/CEF docs, tracker/testing tools). Results are unverified; claims used in results are marked and checked.
- Scaffolded `tauri/`: copied Electron renderer, replaced preload bridge with `HostApi` + Tauri adapter, 4 Rust commands.
- Build 1 failed: missing `serde` dependency for the derive. Fixed.
- First run under Xvfb: blank white window. Suspected upstream WebKitGTK/Xvfb bug (tauri#15936) and tried DMABUF/compositing/software-GL env vars; none changed anything. Real cause found by injecting a diagnostic script: `app.security.freezePrototype: true` made a library assign to a read-only property, so the bundle never ran. Removed it. Lesson: this hardening option breaks the Fluent/React/ECharts bundle.
- Second failure: `invoke` of a raw `Response` returns an ArrayBuffer, not a string. Fixed in the adapter.
- Slice renders on Linux with no graphics workaround needed in this sandbox.
- Mistake: committed tauri/e2e/node_modules (14.5k files, ~7 MB packed). Removed from the index in the next commit; history still contains it because a force-push was not allowed. A reviewer may squash.
- CI run 1: bundling failed everywhere: tauri rejects bundle.category 'Office' (valid: e.g. Finance). Fixed.
