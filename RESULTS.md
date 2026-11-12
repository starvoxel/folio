# Results: Tauri 2 + React slice

- Stack and exact versions: Tauri 2.12.5 (`tauri` crate, `tauri-build` 2.7.4, `wry` 0.57.2, `tao` 0.37.2, `@tauri-apps/api` and CLI 2.12.4), Rust 1.99.1 stable on the CI runners (1.97.0 in the dev sandbox), TypeScript 7.0.2 strict, Vite 8.3.8, React 19.3.1. Test tooling: WebdriverIO 9.31.9 with `@wdio/tauri-service` 1.5.1 (embedded driver provider) and the Rust crates `tauri-plugin-wdio` and `tauri-plugin-wdio-webdriver` 1.5.1 (test builds only).
- Design system and version: the same renderer as the Electron slice: Fluent UI React v9 `@fluentui/react-components` 9.75.2, TanStack Virtual 3.14.26, ECharts 6.1.0 (SVG renderer).
- Web views under test (measured, from the runs): Linux WebKitGTK 2.52.6 (Ubuntu 24.04 package); Windows WebView2 runtime 156.0.4314.58 (Edge 156) on Windows Server 2025; macOS 26.7.2 with WebKit 21624.5.1.11.3 (`AppleWebKit/605.1.15`).
- Date range of the work: 2026-11-12, one session, about 3.5 hours wall clock (about 15:45 to 19:15 UTC; most of it waiting for CI).
- Commit measured: the head of `spike/slice-tauri` when this file was committed; CI evidence is per run and listed below. CI also committed its own result files to the branch under `tauri/evidence/ci/` (each CI run overwrites them; `tauri/evidence/perf-history.txt` keeps every run's memory and frame numbers).

Everything is from this sandbox (Linux, Xvfb, software rendering) and the GitHub-hosted runners `ubuntu-24.04`, `windows-2025` (Windows Server 2025) and `macos-latest` (macOS 26, Apple silicon). No machine with a real GPU, Wayland, or a real desktop session was available. Workflows: `.github/workflows/tauri-slice.yml`, `tauri-extras.yml`, `tauri-diag.yml`.

## The short answer

**Tauri meets the six gates' pass conditions except memory (G2) on two of three OSes, and it is not materially lighter than Electron in memory. It is dramatically smaller to install.**

- **Size: yes, materially smaller.** Windows installer 1.4 MB (NSIS) against Electron's 121 MB; Linux `.deb` 1.7 MB against 101 MB; macOS `.dmg` 1.7 MB. The Linux AppImage is 81 MB (it bundles WebKitGTK) against Electron's 126 MB. Prices of the small size: the app depends on the OS web view (WebView2 must be installed or downloaded, `libwebkit2gtk-4.1` must be present for the deb), and the web view is whatever version the user has.
- **Memory: no, once every web view process is counted.** The app's own process is tiny (4 MB on Windows, 28 to 33 MB on macOS, about 100 MB PSS on Linux), which is what a naive tool reports and what makes Tauri look light. The page runs in separate OS web view processes (found and counted on all three OSes, method below). Counting them, memory after scrolling the 10,000-row grid was, against Electron under the same metrics (CI runs, ranges over three runs):

| OS and metric | Tauri, all processes | Electron (its F1, run B) | Tauri vs Electron |
| ------------- | -------------------- | ------------------------ | ----------------- |
| Linux PSS, P2 / P3 | **543 to 564 / 549 to 561 MB** | 441 / 429 MB | **25 to 30% higher** (fails 400 MB, as Electron does) |
| Linux PSS, same, `WEBKIT_DISABLE_DMABUF_RENDERER=1` | 297 to 304 / 304 to 315 MB | 441 / 429 MB | about 30% lower (passes 400 MB), but only with a non-default WebKit setting |
| Windows private working set, P2 / P3 | 150 to 153 / 151 to 157 MB | 161 / 161 MB | about 6% lower (passes) |
| Windows total working set, P2 / P3 | 422 to 426 / 423 to 425 MB | 395 / 395 MB | about 7% higher (Tauri fails 400 MB; Electron passed by 5 MB) |
| macOS physical footprint, P2 / P3 | **507 to 517 / 560 to 641 MB** | 206 / 200 MB | **about 2.5 to 3 times higher** (fails 400 MB) |

  So the memory win that motivated the question did not materialise on Linux (default graphics path) or macOS, and on Windows it is a few percent. The Windows figure is the only one where Tauri's design (reusing the OS-wide WebView2 runtime) shows, and even there the web view's own processes are most of the memory. Why this is, and what I could not test (real GPUs), is under Problems. **Jeremy should not expect a memory improvement from moving to Tauri on this evidence.**
- **Privacy: credible on Linux and macOS, not fully provable on Windows.** No non-loopback packet or `connect()` from the app on Linux in a five-minute idle capture plus a driven capture; macOS sampling found no non-loopback socket from the app or its WebKit helpers; Windows results are in the privacy section. The Windows WebView2 runtime sends required diagnostic data under Microsoft's terms and the app cannot turn that off; the runner cannot see traffic sent by Windows system services.
- **Testing: works on all three hosted runners**, with the embedded WebDriver (`@wdio/tauri-service`), but the test binary is a different build from the shipped one (extra crates, extra config, a local HTTP server on 127.0.0.1:4445 when started with `FOLIO_AUTOMATION=1`), and the driver cannot send real key events (workaround in the testing section).
- **Linux risk is real:** WebKitGTK's own process sandbox is **off** in a Tauri app (measured: no seccomp, no namespace, no bubblewrap, for both the `.deb` and the AppImage), a blank window or a 25 s start-up stall appeared in specific runner environments (found and explained), and GPU memory behaviour differs sharply between graphics paths.
- **Rust cost:** 105 lines for the slice, about 120 more for safe saving and locking (not in the slice). The renderer changed by 5 added and 7 removed lines of 873.

## Gates

| Gate | Pass / Fail / Not measured | Evidence | Notes |
| ---- | -------------------------- | -------- | ----- |
| G1 Privacy | **Pass on Linux** (traffic and syscalls). **macOS: pass at low-to-moderate confidence** (socket sampling every 3 s). **Windows: see Privacy capture** | `tauri/evidence/ci/extras-linux/` (`capture-analysis.txt`), `tauri/evidence/ci/macos-network/`, `tauri/evidence/ci/windows-privacy/` | No updater, telemetry or networking crate is compiled in. WebKitGTK leaves hyperlink auditing on; the CSP is what blocks it. WebView2 collects required diagnostic data regardless of the app (documented by Microsoft). |
| G2 Grid at scale | **Fail on Linux (default graphics path) and macOS; Windows passes on private working set and fails on total working set by 22 to 26 MB.** Frames and sorts: pass on Linux and Windows; **macOS exceeded 100 ms frames in 2 of 3 runs**. | `tauri/evidence/perf-history.txt`, `tauri/evidence/ci/slice-*/perf-*.json` | See the numbers table and the Electron comparison above. Which metric the 400 MB limit applies to is Jeremy's call; every metric is reported. Sort times 27 to 94 ms, well under 500 ms. No growth beyond noise from scroll 2 to the end of the soak (see FOLLOWUP-RESULTS). |
| G3 Testable and agent-drivable | **Pass on Linux, Windows and macOS** (15 scenario tests plus a separate quit test, same scenario as Electron's 16) | `tauri/evidence/ci/slice-*/slice-run*-*.log` (latest CI run 43281822626 and its two predecessors), screenshots under `shots/` | Two consecutive Linux runs in one job: 0 differing pixels in 10 of 11 screenshots, 68 pixels (0.005%) in one; the next workflow run's screenshots also matched (tolerance 0.1%). Windows and macOS matched too. Dialog focus and Escape verified on all three. Caveats: test binary differs from the shipped one; keys need an OS-level helper. |
| G4 Charts | **Pass** (light and dark, click-through, legend by keyboard) | same scenario; screenshots | Donut centre label renders in WebKitGTK and WKWebView and in WebView2 (it did not render in the Electron slice's first version; that was Electron's mistake, fixed there later). |
| G5 Footprint | **Pass** (recorded; nothing over a ceiling) | `sizes-*.txt`, `cold-start-*.txt`, perf JSON | Installers 1.4 to 1.9 MB (AppImage 81 MB); cold start to first web view process 222 to 233 ms (Linux), 415 to 880 ms (Windows), 205 to 947 ms (macOS); idle memory (P0, all processes) 384 to 389 MB Linux, 89 to 92 MB Windows, 89 to 113 MB macOS, all under the 800 MB ceiling. |
| G6 Licences and cost | **Pass, with one flag** | `cargo metadata`, lockfiles | Nothing paid. Seven crates are MPL-2.0 (`cssparser` x2, `cssparser-macros`, `dtoa-short`, `option-ext`, `selectors` x2): file-level copyleft, not "MIT or equivalent". They come in through `tauri-utils`; I did not check whether they end up in the shipped binary. |

## Numbers

Memory: whole-web-view totals (all processes), CI, accessibility off. First number is the range over three workflow runs.

| Measure | Linux (default graphics, Xvfb software GL) | Windows | macOS | How measured |
| ------- | ------------------------------------------ | ------- | ----- | ------------ |
| Installer or package size | deb 1,683,602 B (1.7 MB); rpm 1,689,203 B; AppImage 80,579,064 B (81 MB); binary 3,550,752 B | NSIS setup 1,411,178 B (1.4 MB, **WebView2 download bootstrapper mode**); MSI 1,884,160 B; binary 3,266,560 B | dmg 1,656,636 B (1.7 MB); `.app` 3,244 KB (du); binary 3,300,048 B | `ls -l` in CI after `tauri build`. Windows installers do **not** include the web view: the default `downloadBootstrapper` mode downloads WebView2 at install time if it is missing. Not built: embed bootstrapper, offline installer, fixed runtime (sizes below are from docs only). |
| Cold start | 222, 229, 231, 231, 233 ms (one run; earlier runs were affected by the D-Bus stall) | 415 to 880 ms (15 samples over 3 runs; latest run 880, 586, 571, 598, 592) | 205 to 947 ms (15 samples; latest run 556, 324, 260, 284, 331) | **Not the Electron definition.** Spawn to the first web view process present (`scripts/cold-start.mjs`, polling `ps` or WebView2 process count), shipped binary, no driver. Electron measured launch to "state ready", which includes first render. On Linux this only works under `dbus-run-session` (see Problems). |
| Idle memory (P0, all processes) | 384 to 389 MB PSS (app only 98 to 102) | 89 to 92 MB private WS; total WS 331 MB (app only 4) | 89 to 113 MB footprint (app only 28 to 30) | Overview page, 5 s after ready; test build with the WebDriver server. The shipped binary without a driver: Linux 377 MB (app 93), Windows 85 MB, macOS 86 MB; the driver costs a few MB. |
| Memory after full scroll, first pass (P2) | 543 to 564 MB PSS | 150 to 153 MB private WS (total WS 422 to 426) | 507 to 517 MB footprint | `scripts/memtree.mjs`, see FOLLOWUP-RESULTS for P0 to P5 |
| Memory after second scroll (P3) | 549 to 561 MB | 151 to 157 MB (total WS 423 to 425) | 560 to 641 MB | same |
| Worst frame time while scrolling | 28 to 46 ms (17 to 38 with the DMABUF renderer off); 0 frames over 100 ms in 9 passes | 16 ms (0 of 1,800 frames) | 22 to 285 ms; **7 frames over 100 ms in one run's passes, soak worst 121 ms in another run** | `requestAnimationFrame` deltas, same code as Electron's perf spec. 600 frames per pass, 3 passes. |
| Sort time (Date, Description, Account, Category, Amount) | 67 to 94 ms worst of 3 | 27 to 47 ms | 30 to 60 ms | same method as Electron's (click to two paints). Electron: 29 to 32 ms. Linux sorting is about 2 to 3 times slower than Electron, still far inside 500 ms. |
| Build time (clean, no cache) | shipped build plus bundles 178 to 190 s; test build 136 to 148 s | 282 to 289 s; 283 to 285 s | 110 to 144 s; 115 to 179 s | CI step timings, cold `cargo` compile of about 315 crates. Electron: Vite 1.4 s, packaging about 3 s, plus 23 s for `npm ci`. Incremental Rust builds are much faster (not measured on CI). |

## Effort

- Active working time: about 3.5 hours wall clock in one session. A large share was waiting for CI (three-OS runs take 25 to 45 minutes) and for 5-minute captures.
- Number of prompts or corrections the user had to give: 0 after the kickoff prompt. The session was interrupted twice by status requests (no change of direction). See `EFFORT-LOG.md`.
- Where most time went: (1) CI iteration: bundling failed on an invalid `category`, the evidence-upload step failed differently on each OS (`cp --parents` is not on macOS; a PowerShell syntax slip; CRLF noise blocking `git pull --rebase` on Windows), a 25 s D-Bus start-up stall on the Linux runner, a mocha timeout; (2) the blank window caused by `freezePrototype`; (3) writing measurement code that finds all web view processes on each OS; (4) the WebDriver port of the 16 tests (selects, keys, `getWindowSize`, a macOS-only serialisation bug in my own test).

## Fidelity against the prototype

Same renderer as Electron's, so the fidelity statement for the Electron slice holds (Fluent v9 theme, not pixel-matched to the prototype). Differences I saw between engines:

- Screenshots are in `tauri/evidence/ci/slice-*/shots/` (every page, light and dark, dialog) and `tauri/evidence/local-linux/shots/`. Electron's are in its branch under `electron/evidence/fidelity/`.
- Fonts: Latin text uses the system UI font on each OS (the renderer bundles no font). CJK and Cyrillic render in the Transactions grid in the screenshots I viewed (Linux with the Noto fonts installed on the runner, macOS). Windows screenshots were not inspected for glyphs.
- The donut centre total and the bar legend render in all three web views. 
- The macOS runner's screen is small, so the 1440x900 window is clipped: macOS screenshots are about 1024 px wide and the layout wraps differently (the file name wraps in the top bar). Linux and Windows screenshots are full size.
- No rendering defect specific to WebKit was seen: no missing glyphs, no chart clipping. What I did not test: Safari 16 era engines, HiDPI scaling, Wayland, a real GPU.

## Dependencies

- Rust: **315 normal-dependency crates** for the Linux target (343 with build dependencies), 262 for Windows, 263 for macOS; 414 packages in the lockfile across all targets and features. Direct: `tauri`, `serde` (plus optional `tauri-plugin-dialog`, `libc`, and for test builds `tauri-plugin-wdio` and `tauri-plugin-wdio-webdriver`). The test feature adds an HTTP server stack (`axum`, `hyper`, `tower`) for the embedded WebDriver; the shipped build has **no** HTTP client or server crate (checked with `cargo tree` for all three targets: no `reqwest`, `hyper`, `ureq`, `curl`, `sentry`, `updater`, TLS crates; `http` is a types crate, `tokio` is the async runtime). No updater, telemetry or analytics crate. Licences (all 414): MIT OR Apache-2.0 189, MIT 100, Apache-2.0 OR MIT 32, Unicode-3.0 18, MIT/Apache-2.0 12, Zlib/Unlicense variants and others, MPL-2.0 7, BSD-3-Clause 2 or more, one LGPL-2.1-or-later option inside an `MIT OR Apache-2.0 OR LGPL-2.1-or-later` expression. System libraries on Linux (GTK, WebKitGTK) are LGPL and dynamically linked.
- Single-maintainer, deprecated or near-abandoned crates: **not audited.** I did not check maintainers. `@wdio/tauri-service` and the two `tauri-plugin-wdio*` crates are young (first release December 2025 according to a research agent, not verified by me) and the test plugin warns against production use.
- npm: app package 228 packages, all dev dependencies (the renderer bundle is built from them; nothing is shipped as `node_modules`). Licences: MIT 169, Apache-2.0 24, Apache-2.0 OR MIT 14, MPL-2.0 12 (the Vite CSS tool chain, not shipped), 0BSD 3, BSD-3-Clause 3, ISC 2. Test package (`tauri/e2e`): 519 packages, all dev, one CC-BY-4.0 data package. `npm audit` on the test package reported 24 vulnerabilities (10 moderate, 14 high) in WebdriverIO's dev tree; not investigated, none ships.

## Accessibility

See `FOLLOWUP-RESULTS.md` F3 for the platform trees. Keyboard reach is the same as the Electron slice's (same markup); the legend-by-keyboard and dialog tests pass on all three OSes with real OS key events. **Differences by engine:** WebKitGTK exposes the grid as a table with `rowcount` 10,001 but gives most grid cells an empty accessible name; WKWebView exposes only the rendered rows (23), not 10,001; WebView2's UI Automation tree matches Chromium's (DataGrid 10,001 rows, cells named).

## Agent drivability (G3 mechanism)

The app starts with `FOLIO_AUTOMATION=1`. The renderer then exposes `window.__folio` (`getState`, `navigate`, `settled`), same as Electron. WebdriverIO talks to the real window through a W3C WebDriver server that runs **inside the app** (`tauri-plugin-wdio-webdriver`, `127.0.0.1:4445`), with no external driver on any OS.

How it is gated in Rust (`src-tauri/src/lib.rs`): (1) the two plugins are behind the cargo feature `automation`, which the shipped build does not enable, so a shipped binary has no WebDriver server at all; (2) in a build that has the feature, they are registered only when the environment variable `FOLIO_AUTOMATION` equals `1` at start-up (`automation_requested()`), nothing the page can influence; (3) the renderer hook `window.__folio` is only created if `get_config` reports `automation: true`, which is the same variable. **Measured:** the test binary started without the variable: nothing listens on 4445; started with it: 127.0.0.1:4445 listens. Unlike Electron's pipe switches there is no command-line flag to refuse; the refusal is that the server is not present or not started. A user who sets the variable on a test build gets full control of the window.

Commands (Linux; Windows and macOS the same without `xvfb-run`):

```bash
cd tauri && npm ci && (cd e2e && npm ci)
npm run build:ui && (cd src-tauri && cargo build --release)      # the shipped binary
scripts/build-e2e.sh                                              # the test binary (own target dir, own frontend dir)
cd e2e && FOLIO_SPEC=./specs/slice.e2e.ts xvfb-run -a -s "-screen 0 1440x900x24" npx wdio run wdio.conf.ts
```

Sample state, same shape as Electron's:

```json
{"ready":true,"page":"transactions","title":"Transactions","shell":{"fileName":"Household 2026.folio","navItems":["Overview","Transactions","Reporting","Net worth","Accounts","Rules & categories","Settings"]},
 "dialog":{"open":false,"title":null,"focusInside":false},
 "transactions":{"totalRows":10000,"visibleRows":10000,"renderedRows":29, "...":"..."}}
```

More on what the driver can and cannot do, per OS, is in `TAURI-FINDINGS.md` (testing per OS).

## Privacy capture (G1)

**Hardening applied from the start (`tauri.conf.json`, `capabilities/main.json`, `build.rs`, `lib.rs`):** no updater, shell, fs, http, opener, notification or log plugin in the shipped build (`tauri-plugin-dialog` only with `--features extras`); `withGlobalTauri: false`; capabilities grant three app commands and nothing else (no `core:default`) and `build.rs` declares the app commands so they are denied unless granted; CSP `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src ipc: http://ipc.localhost; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`; no external URL handling (the app has no link-opening code and no opener plugin); devtools not compiled into release; no `additionalBrowserArgs` (so wry's own WebView2 default applies, which includes `--disable-features=msSmartScreenProtection`). **Not used:** `freezePrototype` (it breaks the renderer, see TAURI-FINDINGS). **Deviation from Electron's hardening:** `style-src 'unsafe-inline'` instead of a nonce.

**Linux** (measured; `tauri-extras.yml`, job "G1 capture, packaging and sandbox"; `scripts/capture.sh` and `scripts/analyze-capture.mjs` are the Electron slice's, unchanged): runs inside a fresh network namespace as root with `tcpdump -i any` and `strace -f -e trace=network`.

| Capture | Duration | Result |
| ------- | -------- | ------ |
| A. Driven test binary through every page, search, filter, sort, selection, click-through, theme, dialog, then idle, sink route (outbound packets would be emitted) | about 300 s idle plus use | 758 text lines: 714 loopback, 44 kernel IPv6 housekeeping on the namespace's own veth, **0 other packets, 0 non-loopback `connect()`/send syscalls**. The analyzer reports 2 DNS queries for external names: `registry.npmjs.org` (and a cloud-internal variant of it). I attribute these to `npx`/WebdriverIO starting in the same namespace, not to the app: they occur about 1.5 s after the namespace starts, from one PID that also does the other lookups of a Node start-up, the CSP forbids page requests, and the capture without a driver (B and C) has none. This attribution is inferred, not measured per process. |
| B. Shipped binary, no driver, launch and idle, loopback-only namespace | 330 s timeout | 0 packets, 0 network `connect()` to anything but local Unix sockets (X11, D-Bus, nscd); 89 PIDs traced, which includes the WebKit processes |
| C. Same, sink route | 330 s | 44 kernel IPv6 housekeeping lines, **0 application packets** |

A positive control for the capture itself was done in the Electron slice (a `curl` to a public address is seen by both tools); I reused its scripts and did not repeat the control here. **Not captured:** a Wayland session, a real network, spellcheck by typing real text (spellcheck is off in WebKitGTK's default context: `get_spell_checking_enabled()` is false).

WebKitGTK settings (measured, `scripts/webkit-settings.py` on 2.52.6, i.e. what wry leaves untouched): **hyperlink auditing is ON** (`<a ping>` would send a request; the page has none, and the CSP `connect-src` would block it), DNS prefetching OFF, spellcheck OFF, WebRTC OFF, media stream ON, developer extras OFF. wry sets none of these (re-read: no mention in `wry-0.57.2/src`).

**Windows** and **macOS:** see the next two subsections.

### Windows

(Filled from the `windows-privacy` job; see below.)

### macOS

Method: `tcpdump -i any` for the whole job, `lsof -nP -i` every 3 s filtered to processes named `folio` or `com.apple.W*`/`WebKit*`, and the driven scenario then 300 s idle (`scripts/mac-net-tauri.sh`, CI job "G1 macOS network observation"). Result: over about 5 minutes and 100 samples, **no non-loopback socket held by the app or by any WebKit helper**; the only sockets seen were the app's own loopback WebDriver listener (`127.0.0.1:4445`, which doubles as a check that `lsof` sees the app's sockets). The capture holds 132,038 packets for the whole runner, which has its own traffic; the capture format has no process names, so packets cannot be attributed. **Confidence: moderate** that no connection lasted 3 s or longer; **low** for short connections, and DNS lookups go through the system resolver which `tcpdump` here did not show per process. WKWebView's own services (for example the fraudulent-website check) would run in system processes (`com.apple.WebKit.*` helpers, `trustd`, `mDNSResponder`); I did not look at those beyond the helpers. **Safe Browsing:** wry never sets `isFraudulentWebsiteWarningEnabled` (re-read: no `fraud` or `SafeBrowsing` in `wry-0.57.2/src/wkwebview`), so it stays at the system default, which I believe is on (inferred). It can make a lookup to Apple for navigations; the app performs no navigation except its own `tauri://` origin, so I would expect none, but I did not observe that either way.

## Problems and workarounds

See `TAURI-FINDINGS.md` for detail. In order of importance:

1. **Memory is dominated by the OS web view process, and depends on the graphics path.** On Linux the WebKitWebProcess alone is 264 MB (P0) to 467 MB (P5) PSS (default) or 130 to 207 MB with `WEBKIT_DISABLE_DMABUF_RENDERER=1`; the runner has no GPU and uses software rendering, so a real desktop may differ in either direction. On macOS the WebContent process goes from 56 MB footprint at P0 to 469 MB at the first full scroll and 522 MB at the second, and stays near 500 MB after 60 s idle (all-process totals 560 to 641 MB at P3 across runs), not back to the 90 MB baseline. I did not shrink anything.
2. **`freezePrototype: true` blanks the window** (found, explained, left off).
3. **The shipped binary stalled for 25 s on the hosted Linux runner** before showing its window, with the runner's default environment (`XDG_RUNTIME_DIR` has a `bus` socket but `DBUS_SESSION_BUS_ADDRESS` is unset). Under `dbus-run-session`, or with the bus address pointed at nothing, it started in about 1 s. Evidence: `tauri/evidence/ci/diag/` (variants plain, automation-env, dmabuf-off, compositing-off, sw-gl, no-a11y, no-portal all stalled for 24 to 27 s; dbus-session and no-dbus did not). I did not find which D-Bus call it is (25 s is the D-Bus default timeout). My first captures of the shipped binary on CI showed no web view because I measured before the stall ended. A user with a broken session bus would see this too.
4. **Blank window under Xvfb (tauri#15936, reported by a research agent) did not occur** in this sandbox or on the runner with any of the variants; the blank window I saw was problem 2.
5. **The embedded WebDriver is not a full user simulation:** `browser.keys()` sends synthetic DOM events that do not move focus on Tab; select commands do not fire React's change event; `getWindowSize()` returns 0x0; on macOS `executeAsync` rejects a result holding DOM objects (my test bug). Workarounds: OS-level key injection (`xdotool` on Linux, `SendKeys` on Windows, `osascript` on macOS; all three worked on the hosted runners without any permission prompt), `change` dispatched from script for selects.
6. **The test binary is not the shipped binary.** It is built with two extra crates, a test-only config overlay (`withGlobalTauri: true`, an extra capability), and a renderer import. Memory with it was a few MB higher than the shipped binary (Linux 383 against 377 MB at idle). Electron had the same kind of gap (one fuse); Tauri's is larger.
7. **Packaging:** the Windows installer pulls WebView2 over the network at install time (default mode); the `.deb` depends on `libwebkit2gtk-4.1-0` and `libgtk-3-0`; the macOS bundle is unsigned and was not notarised or opened by Gatekeeper.
8. Smaller: `invoke` of a raw byte `Response` returns an `ArrayBuffer`; `category: "Office"` rejected; `npx tauri build` must be preceded by `vite build` (no `beforeBuildCommand` is set); Tauri's CLI `--bundles` list differs per OS.

## Opinion

**Easy:** the shell. About a hundred lines of Rust and a short config got the same React renderer running in three OS web views with a deny-by-default permission model that demonstrably refuses an ungranted plugin command. Installers of 1 to 2 MB are a real and large difference. The embedded WebDriver route needs no external driver on any OS and ran the full scenario on all three hosted runners with stable screenshots.

**Painful:** measuring. The number everyone quotes for Tauri (the app process) is wrong by a factor of 4 to 20, and finding every web view process differs on each OS (descendants on Linux, command-line match plus descendants on Windows, name match against a pre-launch baseline on macOS because the WebKit helpers are not children). The memory result then removes the main reason to prefer it over Electron. The test build being a different binary, and the keyboard needing OS-level injection, are the other costs.

**What I would worry about for the real app:** (1) memory on macOS, where this slice's grid needed 500 to 640 MB, which is about three times Electron's on the same renderer, and the unknown behaviour on real GPUs; (2) the WebKitGTK sandbox being off, which is a security regression against Electron's sandboxed `.deb`; (3) living with three different engines (WebKitGTK versions follow the distro; WKWebView follows macOS; WebView2 follows the runtime), which makes every visual and performance regression per-OS (the macOS frame stalls above, Linux sorts 2 to 3 times slower than Chromium); (4) privacy on Windows, where the runtime's own telemetry is outside the app's control; (5) accessibility gaps in WebKitGTK (empty cell names) and WKWebView (only rendered rows); (6) the real file-handling work (atomic save, locks) is Rust either way, and drag-and-drop of files conflicts with in-page drag-and-drop on Windows. In favour: a Tauri app's renderer is plain web code, so the future web build is as feasible as with Electron, and the renderer changed by 12 lines.

## Comparison with the Electron slice (same scenarios, same metrics where they apply)

| Measure | Electron (its `RESULTS.md`, `FOLLOWUP-RESULTS.md`) | Tauri (this branch) |
| ------- | ----------------------------------------------- | ------------------- |
| Installer: Windows | NSIS 121.5 MB | NSIS 1.4 MB + WebView2 download (MSI 1.9 MB) |
| Package: Linux | deb 101 MB, AppImage 126 MB, zip 124 MB | deb 1.7 MB, rpm 1.7 MB, AppImage 81 MB |
| Package: macOS | not built (unpacked app only) | dmg 1.7 MB, app 3.2 MB |
| Memory P2 / P3, Linux PSS (CI) | 441 / 429 MB | 543 to 564 / 549 to 561 MB (297 to 304 / 304 to 315 with DMABUF off) |
| Memory P2 / P3, Windows private WS | 161 / 161 MB | 150 to 153 / 151 to 157 MB |
| Memory P2 / P3, Windows total WS | 395 / 395 MB | 422 to 426 / 423 to 425 MB |
| Memory P2 / P3, macOS footprint | 206 / 200 MB | 507 to 517 / 560 to 641 MB |
| Idle (P0) Linux PSS / Windows private WS / macOS footprint | 350 / 96 / 123 MB | 384 to 389 / 89 to 92 / 89 to 113 MB |
| Worst frame (Linux / Windows / macOS) | 16.8 / 15.8 ms / frames not recorded on macOS | 17 to 46 / 16 / 22 to 285 ms |
| Sort time (worst column) | about 32 / 30 ms (Linux / Windows) | up to 94 / 47 ms (macOS 60) |
| Cold start (not the same definition) | 490 / 696 / 1,188 ms to ready (Linux / Windows / macOS) | 222 to 233 / 415 to 880 / 205 to 947 ms to first web view process |
| Build time, clean | 1.4 s Vite + about 3 s package | 110 to 289 s cargo compile |
| Renderer lines changed | n/a (source) | 5 added, 7 removed of 873 |
| Host code | 216 lines TypeScript | 105 lines Rust + 36 TypeScript |
| Linux web content sandbox | on in the deb (needs an AppArmor profile), off and silent in the AppImage | **off** in both deb and AppImage (measured) |
| G3 test binary vs shipped | 1 fuse differs | extra crates, config overlay and renderer import differ |
