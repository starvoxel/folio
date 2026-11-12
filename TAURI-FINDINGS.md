# Tauri findings

Branch `spike/slice-tauri`. Companion files: `RESULTS.md` (gates and numbers), `FOLLOWUP-RESULTS.md` (F1 memory, F2 macOS, F3 accessibility), `EFFORT-LOG.md`. Raw evidence: `tauri/evidence/` (`ci/` = committed by the CI jobs themselves, `local-linux/` = the dev sandbox).

How to read the labels: **measured** = a number or output I produced and have the file for; **read** = I read the cited source or page myself; **agent** = a research subagent reported it and I either re-checked it (said how) or it stays marked unverified; **inferred** = my reasoning, not observed.

## 1. Shell portability (lines changed)

The renderer is the Electron slice's renderer, copied from `origin/spike/slice-electron:electron/src/renderer` and `src/shared`.

| What | Electron slice | Tauri slice | Change |
| ---- | -------------- | ----------- | ------ |
| Renderer (`src/renderer`, 873 lines) | 873 | 871 | **5 lines added, 7 removed** (one blank line each), all in `main.tsx`, `global.d.ts` and `index.html` (details below) |
| Shared types and validation (`src/shared`) | 101 | 96 | 5 lines removed (the `FolioBridge` interface moved to `HostApi`) |
| Build config (`vite.config.ts`) | 8 | 8 | 8 lines differ: build target `chrome140` became `safari16 + chrome110`, plus an `e2e` output mode |
| Host code | TypeScript main process: 216 lines (`main.ts` 89, `hardening.ts` 61, `protocol.ts` 58, `preload.ts` 8) | Rust: 91 (`lib.rs`) + 5 (`main.rs`) + 9 (`build.rs`) = **105 lines of Rust**; TypeScript adapter 36 lines (`HostApi` 17, Tauri adapter 19) | new host, not a port |
| Host config | `package.json` fuses and packager script | `tauri.conf.json` 39 lines, one capability file 6 lines | |

The renderer changes: `main.tsx` imports the Tauri adapter (1 added), calls it instead of `window.folio` (3 lines removed, 1 added), and loads the WebDriver helper only in an `e2e` build (comment, dynamic import and a blank line: 3 added). `global.d.ts` loses the `window.folio` declaration (3 removed including a blank). `index.html` loses the `csp-nonce` meta tag (1 line), because Tauri does not template a per-load nonce. Nothing in `App.tsx`, `Grid.tsx`, `Charts.tsx`, `model.ts`, `automation.ts` or `styles.css` changed. **Measured** with `diff -ru` against the Electron files.

What "shell-agnostic" means here: the renderer imports `tauriHost` in exactly one place. A web build would add another `HostApi` implementation (fetch plus File System Access API). The test hook `window.__folio` is published by the renderer itself and needs no host support, so it works in any shell and in a browser.

One portability cost that is not a line count: **the renderer had to be built for older engines**. Electron pins Chromium 156; Tauri uses whatever WebKitGTK, WKWebView or WebView2 the user has. I changed the Vite target to `safari16, chrome110`; the bundle runs on the WebKitGTK 2.52 and WKWebView (Safari 26 era) that the runners have. I did not test Safari 16 or an older WebKitGTK, so the lower bound is unverified.

## 2. Rust burden

| Item | Lines of Rust | Notes |
| ---- | ------------- | ----- |
| The measured slice (`lib.rs`, `main.rs`, `build.rs`) | **105** | four commands (`get_config`, `load_data`, `quit_app`, `open_csv_dialog` stub), gated automation, ACL manifest |
| `extras.rs` (real-app experiments, behind `--features extras`) | **200** including 5 unit tests (about 120 without tests) | atomic save, lock file with stale-lock detection, CSV drop event, native dialog command |

Everything the slice needed from Rust: read three fixed files from a configured directory and hand the bytes to the web view; report a config; exit. No Rust was needed for the UI. I did not write any Rust that parses data (the TypeScript validator from the Electron slice runs in the renderer).

**What could not be done from TypeScript with the official fs plugin** (read: plugin docs and `@tauri-apps/plugin-fs` exports; I did not add the plugin): there is no fsync of a file, no fsync of a directory, no atomic rename-over-target guarantee (the plugin has `rename`, which is `std::fs::rename`, but you cannot fsync before it) and no advisory or exclusive lock. A crash-safe save and a "file in use" lock therefore need Rust. `extras.rs` implements:

- `atomic_write`: temp file in the same directory (`create_new`), `write_all`, `sync_all`, `rename` over the target, then `fsync` of the directory on Unix. On Windows there is no directory fsync; `std::fs::rename` maps to `MoveFileExW` with replace, which is the best the standard library offers.
- `FileLock`: `create_new` lock file with `pid` and `host`; takes over a stale one when the owner is dead on this host (Unix `kill(pid, 0)`) or the file has had no heartbeat for 30 s; `heartbeat()` touches the mtime; the lock is removed on `Drop`. **Not done:** a real OS advisory lock (`flock`/`LockFileEx`) and a Windows liveness check; on Windows staleness is by heartbeat age only. **Not tested:** two processes racing, NFS or cloud-synced folders, crash during takeover.
- Tests: 5 unit tests (replace, failure keeps old content, exclusivity and release on drop, dead-pid takeover, heartbeat expiry). They pass (`cargo test --features extras`, local Linux sandbox). They have not been run on Windows or macOS.

Time spent on the extras: about an hour including the compile.

Native CSV drag-and-drop is wired through `WindowEvent::DragDrop` and re-emitted to the page as `folio://csv-dropped` (extras build only). **Not exercised in a real window**: no CI driver can drag a file from the desktop. What I read, and what the research agent reported and I re-read in Tauri's config docs: `dragDropEnabled` defaults to true; when true, Tauri replaces the web view's own file-drop handling, and on **Windows** HTML5 drag-and-drop inside the page stops working (forbidden cursor), so an app cannot have both. macOS and Linux are less clear in the sources I read; tracker issue 14373 (agent report, not opened by me) says macOS also blocks DOM drag-and-drop. The practical consequence for Folio: if the real app wants drag-reordering of rows or categories in the page, it has to choose between that and dropping CSV files onto the window.

## 3. Findings that the research agents supplied, and how I checked them

Three read-only agents were used (the only agent use, approved for research). Their reports are unverified model output; this table says what I did with each claim I rely on.

| Claim | Source | How I checked |
| ----- | ------ | ------------- |
| wry 0.57.x sets no hyperlink-auditing, DNS-prefetch, spellcheck, Safe Browsing, sandbox or DMABUF settings for WebKitGTK; sets no fraudulent-website setting for WKWebView | agent (read the crate source) | **Re-read**: `grep -rniE "hyperlink\|prefetch\|spell\|safe_?browsing\|fraud\|sandbox\|dmabuf\|WEBKIT_"` over `wry-0.57.2/src` in my cargo registry returned nothing relevant (only version getters). Also confirmed at run time: see section 5. |
| WebView2 default args in wry: `--disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection`; replaced entirely if the app sets additional args | agent | **Re-read** `wry-0.57.2/src/webview2/mod.rs:309-312` |
| wry exposes no WebView2 crash-reporting or SmartScreen (`IsReputationCheckingRequired`) setting | agent | **Re-read**: grep for `CustomCrash`, `FailureReport`, `ReputationChecking` found nothing |
| `freezePrototype` runs `Object.freeze(Object.prototype)` | not asked of agents | **Read** `tauri-utils/src/config.rs:3056`, after it broke my bundle (section 4) |
| Tauri CEF runtime exists only as `tauri-runtime-cef` 3.0.0-alpha.x, is "not available in Tauri 2.0", adds "hundreds of megabytes", downloads about 1 GB of CEF, and runs unsandboxed on Windows (Chromium M138 broker restriction) | agent | **Read** the official page `v3.tauri.app/develop/cef/` and the crates.io index (alpha.0 to alpha.7). I did **not** run a CEF trial (optional item, skipped for time). |
| WebView2 required diagnostic data is collected regardless of the Windows setting; the app can only control SmartScreen and custom crash reporting | agent (Microsoft Learn data-privacy page) | **Not re-read by me**; consistent with the brief's own statement. Treated as the documented position, not as something I observed. |
| WebView2 Fixed Version is over 250 MB; Tauri docs say it adds about 180 MB to the installer; offline installer about 127 MB; embedded bootstrapper about 1.8 MB | agent (Tauri config docs, Microsoft docs) | **Not re-read; not built**. I built only the default (`downloadBootstrapper`) installer and measured that. |
| tracker items: Xvfb blank window (tauri#15936), DMABUF/NVIDIA/Wayland (#10702, #9394), `tauri-driver` Send Keys bug on newer WebKitWebDriver (#15871), `dragDropEnabled` limits (#15138, #14373), macOS 60 fps cap (#13978) | agent (read through a summariser, second-hand) | **Not opened by me.** Where my own runs touch them I say what I saw (blank window, section 4; keys, section 6). The macOS 60 fps item is not something I measured. |
| Package sizes, versions (tauri 2.12.5, wry 0.57.2, tao 0.37.2, CLI and API 2.12.4, `@wdio/tauri-service` 1.5.1) | agent plus me | **Re-checked** against crates.io index and `npm view` before pinning |

## 4. Hardening problems found while building (not in the agents' reports)

- **`freezePrototype: true` breaks the renderer.** With it on the window was blank: React/Fluent/ECharts assign to inherited read-only properties and the bundle threw `TypeError: Attempted to assign to readonly property` before mounting. I found it by injecting a diagnostic script (no devtools in a release build); I first misread the blank window as the upstream Xvfb/DMABUF problem and tried three graphics workarounds that did nothing. Removed it (this is the only hardening switch I had to leave off). Any app built on a mainstream UI stack should expect to leave it off.
- **CSP**: Tauri does not template a per-load nonce, so Fluent's runtime-injected `<style>` needs `style-src 'unsafe-inline'`. Script and connect policy stay strict: `default-src 'none'`, `script-src 'self'`, `connect-src ipc: http://ipc.localhost`, `base-uri 'none'`, `form-action 'none'`, `frame-ancestors 'none'`. This is weaker than the Electron slice (nonce-only styles).
- **The ACL denies by default and works.** `build.rs` declares the four app commands in an `AppManifest`; the capability grants three of them (`allow-get-config`, `allow-load-data`, `allow-quit-app`); no `core:default`, no fs, shell, http or opener plugin is compiled in. In the driven tests a call to `plugin:fs|read_text_file` from the page is refused: `Command plugin:fs|read_text_file not allowed by ACL` (all three OSes, `acl-denied-*.txt`).
- **A byte-array `Response` arrives in JS as an `ArrayBuffer`**, not a string; the adapter decodes it with `TextDecoder`.
- **Bundler**: `bundle.category: "Office"` is rejected by the Tauri bundler ("invalid category"); I used `Finance`.

(Sections 5 onward: privacy per OS, testing per OS, Linux packaging and sandbox, web view pinning, CEF, are filled in below from the CI evidence.)
