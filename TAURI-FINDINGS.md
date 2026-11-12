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

## 5. Privacy per OS

The full captures and method are in `RESULTS.md` (Privacy capture). Summary, with what each OS can and cannot support:

| OS | What I observed | Can a Tauri app credibly say "nothing leaves the computer unless opted in"? |
| -- | --------------- | -------------------------------------------------------------------------- |
| Linux (WebKitGTK 2.52.6) | 5-minute idle plus a driven scenario: no non-loopback packet, no non-loopback `connect()` (strace over 64 to 89 PIDs including the web processes). The shipped binary has no networking crate. | **Yes, with caveats.** wry sets none of WebKitGTK's privacy settings (read), so defaults apply: **hyperlink auditing is on** (the CSP blocks `ping`), DNS prefetching and spellcheck are off. WebRTC is off. Nothing in the app can send anything, and the capture agrees. Not tested: a real desktop session (Wayland, portals, IBus or spell-check daemons), real typing. |
| macOS (WKWebView) | 5-minute `lsof` sampling every 3 s: no non-loopback socket from the app or the WebKit helpers; `tcpdump` unattributable. | **Probably, at moderate confidence.** The page and the app make no requests. Apple's own services behind WKWebView (the fraudulent-website check, which wry leaves at the system default, i.e. on by my inference) run outside the app and cannot be seen or switched off from wry. Not observed doing anything here; not proven absent. |
| Windows (WebView2 Evergreen 156) | The `msedgewebview2.exe` process held an ESTABLISHED HTTPS connection to 150.171.x.x:443 during idle in all configurations, including the shipped app and with network-quieting Chromium switches. The sampler was validated with a positive control (example.com). | **No, not with the Evergreen runtime as configured here.** Something in the runtime talks to a Microsoft-range address on its own. Microsoft's documentation (agent-read) says required diagnostic data cannot be disabled by the app, only SmartScreen and custom crash reporting can be controlled, and wry exposes neither crash reporting nor a SmartScreen API (it only passes a `--disable-features` flag). The Fixed Version runtime was not tested, so I cannot say it would be different. A privacy-first Windows build should treat this as an open risk until the Fixed Version result and the registry-policy result are known. |

Hardening that did work: deny-by-default ACL with an app manifest, no plugins, strict CSP (script, connect and form policy), `withGlobalTauri` off, no updater, no external URL handling. Hardening that is not available from Tauri/wry: WebView2 crash-reporting control, SmartScreen API, Safe Browsing switch for WKWebView, WebKitGTK hyperlink-auditing switch (all would need Rust against the platform web view APIs, e.g. `with_webview`; not tried). Hardening that broke the app: `freezePrototype`.

## 6. Testing per OS (G3)

| | Linux | Windows | macOS |
| - | ----- | ------- | ----- |
| Tool that worked | `@wdio/tauri-service` 1.5.1, `embedded` driver (a W3C WebDriver server inside the app on 127.0.0.1:4445), under Xvfb | same | same (needs no external driver; there is no official driver for WKWebView) |
| Scenario | 15 tests plus a separate quit test (the Electron slice has 16): all pages, state as JSON, screenshots, search, filter, sort, selection, mixed-script search, donut, bar and legend click-through, light and dark, dialog | same, 15/15 | same, 15/15 after fixing my test |
| Real key events | needs the OS: `xdotool` | `SendKeys` through PowerShell | `osascript` System Events; worked without a prompt (runner grants accessibility) |
| Could not be done | native file dialog (`open_csv_dialog`), native menus, dragging a file from the desktop, `getWindowSize()` (returns 0x0), native `<select>` via the driver's select commands (no change event), the driver's own `keys()` for Tab | same | same, plus `executeAsync` cannot return DOM objects |
| Setup cost | 2 crates, a config overlay (`withGlobalTauri: true`, an extra capability granting `wdio:default` and `core:default`), a renderer import in `e2e` mode, a separate frontend and target directory (builds twice: 3.5 MB shipped against 5.1 MB test binary on Linux), 519 dev npm packages for the test package, and an OS key helper | same; Windows builds take about 5 minutes each | same |
| Flakiness | no failures in 6 CI scenario runs (3 workflow runs, 2 each) after fixes, and about 8 local runs | none in 6 runs | one deterministic failure in the first run, a bug in my test; none in 6 runs after |
| Screenshots across runs (same code) | within one job 0 differing pixels in 10 of 11 images and 68 (0.005%) in one; the previous workflow run's images matched (0 failed at 0.1%) | matched both ways | matched both ways after the fix; before it, one image differed 1.57% because a failed test left a different page state |
| Between runner image updates | **not testable**: the same image (kernel 7.0.0-1017, WebKitGTK 2.52.6; WebView2 156.0.4314.58; macOS 26.7.2) was used in every run | | |
| Dialog takes keyboard focus on open | yes (focus on Cancel; Tab cycles; Escape closes; focus returns) | yes | yes |
| Web view version recorded | `dpkg`: 2.52.6-0ubuntu0.24.04.1; UA `AppleWebKit/605.1.15 ... Version/60.5` | registry `pv` 156.0.4314.58; UA `Chrome/156.0.0.0 Edg/156.0.0.0` | `sw_vers` 26.7.2, `CFBundleVersion` 21624.5.1.11.3; UA string is frozen (`AppleWebKit/605.1.15`) |

Maintenance state (from `npm view` and the crates.io index, not from the repositories): `@wdio/tauri-service` and `@wdio/tauri-plugin` 1.5.1 (npm modified 2026-11-08), crates `tauri-plugin-wdio` and `tauri-plugin-wdio-webdriver` 1.5.1, with a 2.0.0-next.0 prerelease already out. A research agent reports the project is under the WebdriverIO organisation, first released December 2025, only the main branch receives updates (unverified by me). It is young and moving fast. **Not tried:** `tauri-driver` (official, Linux and Windows only, no macOS) and `tauri-playwright`, because the embedded route already passed on all three OSes. The agent reported an open `tauri-driver` bug with newer WebKitWebDriver (Send Keys) and a BiDi capability problem; I did not reproduce either.

The gating of the test hook and its measured behaviour are in `RESULTS.md` (Agent drivability).

## 7. Linux packaging and sandbox

- **Packages built by Tauri's bundler on ubuntu-24.04 (measured):** `.deb` 1,683,602 B, `.rpm` 1,689,203 B, AppImage 80,579,064 B. The deb declares `Depends: libwebkit2gtk-4.1-0, libgtk-3-0` and an Installed-Size of 3,520 KB. **What `apt` pulls in is not measured meaningfully:** the runner already had `libwebkit2gtk-4.1-dev` installed for the build, so `apt-get install -s` showed only the package itself. On a bare Ubuntu 24.04 desktop WebKitGTK is typically present only if another GNOME app needs it (inferred); the real cost is the `libwebkit2gtk-4.1-0` dependency chain (tens of MB, not measured).
- **Installed and launched under Xvfb as the ordinary runner user:** the deb installed with `apt-get install ./pkg.deb` and `/usr/bin/folio` rendered the page (screenshot mean brightness 0.977, i.e. painted, same as the working builds). The AppImage ran with `--appimage-extract-and-run` (the runner has no FUSE 2) and rendered. **The AppImage bundles WebKitGTK:** the web process in it is `./lib/x86_64-linux-gnu/webkit2gtk-4.1/WebKitWebProcess`, which is why it is 81 MB.
- **Blank window and graphics workarounds:** none needed on this runner. With the runner's default environment, and with each of `WEBKIT_DISABLE_DMABUF_RENDERER=1`, `WEBKIT_DISABLE_COMPOSITING_MODE=1`, `LIBGL_ALWAYS_SOFTWARE=1`, `NO_AT_BRIDGE=1`, `GTK_USE_PORTAL=0` the page painted. The blank window I first saw was `freezePrototype` (see section 4). The one real start-up problem was the 25 s stall (see `RESULTS.md`, Problems). The agent-reported upstream issues (Xvfb blank, NVIDIA, Wayland error 71) are real issues in the tracker (not opened by me) that **my environment could not reproduce**, because it has no GPU, no NVIDIA driver and no Wayland; absence here is not evidence they do not happen on users' machines.
- **Memory depends on the graphics path:** disabling the DMABUF renderer cut Linux memory from 548 MB to 302 MB PSS at P2 and made frames and scrolling smoother in this software-rendered environment, at the price of slower sorts (80 to 94 ms against 67 to 88 ms). Whether either setting is right on a real GPU is unknown.
- **Is the web view's own process sandbox on? No (measured and read).** For the installed deb and for the AppImage, `/proc/<pid>/status` of `WebKitWebProcess` and `WebKitNetworkProcess` shows `Seccomp: 0`, `Seccomp_filters: 0`, `NoNewPrivs: 0`, and the same user, pid and net namespaces as the app; no `bwrap` process exists. Read: wry 0.57.2 never calls `webkit_web_context_set_sandbox_enabled` or `add_path_to_sandbox` (no `sandbox` match in its source), so WebKitGTK uses its default, which in this version is off. The WebKitGTK API to turn it on exists (`WebContext.set_sandbox_enabled` is present in the Python bindings of 2.52.6); using it from a Tauri app needs Rust against the `WebContext` before the web view is created; I did not try it and do not know if wry's WebContext handling allows it.
- **Compared with Electron (its follow-up E2):** Electron's Chromium sandbox on Ubuntu 24.04 needs an AppArmor profile (the deb postinstall writes one) and an AppImage silently runs unsandboxed. Tauri on the same kernel (`kernel.apparmor_restrict_unprivileged_userns = 1`, measured) is **never sandboxed** and so is not affected by the AppArmor restriction at all. The risk therefore differs: Electron can fail to start sandboxed or fall back silently; Tauri has no content sandbox to fail. For an app that loads only its own bundled page and no remote content, the exposure is smaller than for a browser, but a renderer bug in WebKitGTK would run with the user's full privileges.
- **Not measured / cannot be on the runner:** Wayland, real GPUs (NVIDIA, Intel, AMD), Flatpak or Snap (which add a sandbox of their own), distros other than Ubuntu 24.04, older WebKitGTK versions.

## 8. Web view version pinning

| OS | Can the app pin the web view version? |
| -- | ------------------------------------- |
| Linux, deb or rpm | **No.** It uses the distro's `libwebkit2gtk-4.1` (2.52.6 on this runner), updated by the user's package manager. |
| Linux, AppImage | **Yes, in effect.** The AppImage carries its own WebKitGTK (verified), so it stays at the version of the machine that built it, and gets no security updates until you rebuild. |
| Windows | **Evergreen: no** (the runtime updates itself; 156.0.4314.58 here, 871 MB on disk, shared by every app). **Fixed Version: yes**, by shipping a runtime with the app (about 180 MB added to the installer per Tauri's docs, per an agent; not built or tested by me). |
| macOS | **No.** WKWebView is part of the OS; the version moves with macOS updates (26.7.2 here). |

The practical effect: every visual or performance regression is potentially per-OS and per-OS-version, and the CI runner's version is not the user's version. The Electron slice pins Chromium 156 for everyone.

## 9. CEF trial

**Not done.** It is optional and was last on the list; the time went to the CI problems above. What I verified myself (read, `v3.tauri.app/develop/cef/` and the crates.io index): the CEF runtime is `tauri-runtime-cef`, only as `3.0.0-alpha.0` to `3.0.0-alpha.7` (no stable release); the page says it "is new in the Tauri 3.0 alpha and is not available in Tauri 2.0" and that its APIs "may still change"; bundles are "hundreds of megabytes larger than with wry" and use more memory; the first build downloads about 1 GB of CEF; **on Windows it "currently runs unsandboxed regardless of the policy"** (Chromium M138 restricts who can create the sandbox broker, and a Tauri app is not built with Chromium's toolchain), macOS always keeps the sandbox, and Linux keeps it only on systems with unprivileged user namespaces or a setuid helper (an AppImage on Ubuntu 23.10 or later drops it). The page also lists typed switches for `spell_checking`, `safe_browsing` and `component_updates`, i.e. more privacy controls than wry exposes. All of the above confirms what the kickoff prompt reported. I have no size, memory or start-up measurement of it.

## 10. Where this leaves the Electron question

Electron's weakness was size and memory. Tauri fixes size (the installer is 1 to 2 MB, though the AppImage is 81 MB), but not memory on Linux or macOS (and on Windows only the private-working-set metric improves, by a few percent). It adds privacy uncertainty on Windows, a missing web content sandbox on Linux, three web view engines to test, a test binary that differs from the shipped one, and Rust for file safety (needed in any case). It reduces nothing about the future web build: the renderer is unchanged either way.
