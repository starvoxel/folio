# Follow-up results: Tauri slice

Branch `spike/slice-tauri`. Everything below is marked **measured**, **not measured** (with a reason) or **inferred**. Raw evidence is under `tauri/evidence/ci/` (committed by the CI jobs) and `tauri/evidence/local-linux/`; `tauri/evidence/perf-history.txt` keeps the per-run numbers because each CI run overwrites the result files. `RESULTS.md` has the gates; this file has F1 memory, F2 macOS and F3 accessibility, as the follow-up spec asks.

Runners: `ubuntu-24.04` (kernel 7.0.0-azure, WebKitGTK 2.52.6, no GPU, Xvfb), `windows-2025` (Windows Server 2025 build 26100, WebView2 156.0.4314.58), `macos-latest` (macOS 26.7.2, Apple silicon, WebKit 21624.5.1.11.3). Four (Linux, Windows) or five (macOS) complete workflow runs gave the ranges below.

## Corrections to RESULTS.md

None to earlier text in this branch. Two things changed while writing it and are worth knowing: (1) my first captures of the shipped Linux binary on CI looked like "no web view" (one process, black screenshot). That was a 25 s start-up stall on the runner's default D-Bus environment, not a missing web view; the final figures use `dbus-run-session` (see `RESULTS.md`, Problems). (2) A first macOS run failed one test and showed a screenshot mismatch; both were my test code (`executeAsync` returned DOM objects, which WKWebView refuses to serialise); the final runs are 15/15 with matching screenshots.

## F1. Memory, same method

**Metric per OS (measured), counting every web view process.** `tauri/scripts/memtree.mjs` (one definition per OS, same metrics as the Electron slice: Linux PSS, Windows private working set, macOS physical footprint; the same scenario P0 to P5 as `electron/scripts/mem-points.mjs`, driven by `tauri/e2e/specs/perf.e2e.ts`).

How every process of the web view was found, and how I know it is all of them:

- **Linux.** `WebKitWebProcess` and `WebKitNetworkProcess` are **children of the app**. The tool takes the app PID, every descendant from `ps -axo pid,ppid`, and also lists any `WebKit(Web|Network|GPU)Process` that is not a descendant (`orphans`); that list was empty in every sample. 3 processes in every sample (app, network, web). PSS from `/proc/<pid>/smaps_rollup`; RSS beside it. **No GPU process** appears on this runner (software rendering); a machine with a GPU may add one.
- **Windows.** The tool takes the app process, its descendants (`Win32_Process.ParentProcessId`), **and** every `msedgewebview2.exe` whose command line contains the app's identifier (`invalid.example.folio.spike`, which is in the WebView2 `--user-data-dir` path Tauri sets under `%LOCALAPPDATA%`). In all samples the command-line match found 6 processes, the descendant walk found the app plus the same 6, and `notDescendants` was empty: on this runner **WebView2 processes are children of the app and the two methods agree**. Metric: `Win32_PerfFormattedData_PerfProc_Process.WorkingSetPrivate` (the "Working Set - Private" counter), total working set beside it.
- **macOS.** The WebKit helpers (`com.apple.WebKit.WebContent`, `.Networking`, `.GPU`) are **not descendants** of the app (confirmed: `webkitHelpersNotDescendants` lists them in every sample). The tool records the existing `com.apple.WebKit.*` PIDs **before launch** (`memtree.mjs baseline`) and counts every one that is new while the app runs, plus the app and its descendants. On the hosted runner the pre-launch baseline held 0 to 7 helpers from other things; one early run showed 8 and 5 "processes" at P0 and P1 where a later run showed 3, so **the delta method is sensitive to unrelated WebKit activity on the machine** and P0/P1 on macOS carry that uncertainty (P2 onwards were 3 to 4 processes every time). Metric: `footprint -p <pid>` summed (physical footprint), `ps` RSS beside it. I have no second method (for example XPC parentage) to prove completeness; the delta is reasonable on a clean runner and is not proof.
- App-only figure (what a naive tool reports) is given next to every all-process figure.

**Headline table, accessibility off (measured, latest CI run; the ranges over the CI runs are in `RESULTS.md` and `perf-history.txt`).** All-process figures, with the app-only primary metric in the last column.

| Point | Linux PSS (MB) | Linux RSS (MB) | Windows private WS (MB) | Windows total WS (MB) | macOS footprint (MB) | macOS RSS (MB) | App-only: Linux PSS / Win private / macOS footprint |
| ----- | -------------- | -------------- | ----------------------- | --------------------- | -------------------- | -------------- | ------------------------------------------------- |
| P0 Overview, 5 s | 386.6 | 563.2 | 89.2 | 331.4 | 89.4 | 227.8 | 102.1 / 4.0 / 28 |
| P1 Transactions, 5 s | 432.0 | 609.0 | 95.7 | 353.2 | 94.3 | 236.8 | 102.2 / 4.2 / 28 |
| P2 after scroll 1 | **547.7** | 725.2 | 150.2 | **421.7** | **507.3** | 452.7 | 102.3 / 4.3 / 33 |
| P3 after scroll 2 | **548.6** | 726.2 | 151.0 | **423.1** | **560.3** | 495.9 | 102.3 / 4.3 / 33 |
| P4 after scroll 3 + 60 s idle | **559.7** | 737.1 | 102.2 | 370.0 | **557.2** | 505.3 | 101.9 / 4.1 / 30 |
| P5 after soak | **589.5** | 767.0 | 82.4 | 213.1 | **535.9** | 494.7 | 102.0 / 2.9 / 27 |

Linux with `WEBKIT_DISABLE_DMABUF_RENDERER=1` (measured, same job, same scenario; a non-default WebKitGTK setting, shown because the graphics path changes memory by about 40%):

| Point | Linux PSS (MB) | Linux RSS (MB) |
| ----- | -------------- | -------------- |
| P0 | 233.8 | 393.4 |
| P1 | 243.5 | 403.6 |
| P2 | 301.8 | 462.3 |
| P3 | 310.5 | 471.2 |
| P4 | 289.0 | 449.4 |
| P5 | 308.6 | 469.1 |

**Same metrics for Electron (its `FOLLOWUP-RESULTS.md`, run B), for comparison:** Linux PSS 350.3 / 367.5 / 440.7 / 428.9 / 360.3 / 379.0; Windows private WS 95.5 / 104.2 / 160.8 / 161.4 / 103.2 / 66.8, total WS 313.3 / 332.9 / 395.4 / 395.1 / 305.3 / 140.5; macOS footprint 122.8 / 140.8 / 205.8 / 199.8 / 129.6 / 142.6.

**Against the 400 MB G2 limit, per metric (measured; "after scrolling" read as the worst of P2 to P5):**

| Metric | Tauri worst point (the CI runs) | Verdict at 400 MB | Electron |
| ------ | ------------------------------ | ----------------- | -------- |
| Linux PSS, default graphics | 563.7 (P2) to 589.5 (P5) | **Fail** | fail (440.7) |
| Linux PSS, DMABUF renderer off | 315.4 (P3) | Pass | fail |
| Linux RSS sum (default) | 725 to 767 | Fail | fail (817) |
| Windows private WS | 156.9 (P3) | Pass | pass (161.4) |
| Windows total WS | 425.8 (P2) | **Fail** (22 to 26 MB over) | pass by 4.6 MB (395.4) |
| macOS physical footprint | 641.5 (P3) | **Fail** | pass (205.8) |
| macOS RSS | 505 | Fail | fail (542) |

I did not redefine the limit. The all-process view is the honest one; the app-only column would pass everywhere and is wrong. Which metric the limit means is Jeremy's decision.

**Accessibility forced on.** **Not measured.** Electron needed a `--force-renderer-accessibility` run because a screen reader turns Chromium's accessibility tree on. For the OS web views there is no such switch in the shipped app; WebView2 builds its UIA tree when a client asks, WebKitGTK when the AT-SPI bus is present, WKWebView when VoiceOver or an AX client attaches. My F3 runs attach a client but I did not record memory with it attached (the tree dump happens in a separate step). Whether a screen reader changes memory is **unknown** for all three.

**Growth over the soak (P3 to P5, measured).** Linux default: +8, +11, +41 and +32 MB in the four runs (PSS 561.3 to 569.3; 552.1 to 562.8; 548.6 to 589.5; 538.5 to 570.9), so it does not clearly level off within 20 scrolls; the DMABUF-off variant is flat (-2, 0, -2 MB). Windows: private WS falls (153 to 82 MB; Windows trims idle working sets). macOS: footprint falls from the P3 peak (560 to 536 MB; 631 to 493; 641 to 509) but not to the P0 level. Not measured: soak beyond 20 scrolls.

**Frames and sorts during these runs (measured):** Linux 17 to 87 ms worst frame (0 over 100 ms in 12 passes); Windows 16 ms; **macOS up to 285 ms, with 4 and 3 frames over 100 ms in two passes of one run and a 121 ms frame in the soak of another**. G2 says no frame over 100 ms; macOS did not meet that in 2 of 5 runs. Sort worst case: Linux 67 to 94 ms, Windows 27 to 47, macOS 30 to 60.

## F2. macOS

**Measured; it works on the free hosted runner.**
- Build and start: `tauri build --bundles app,dmg` succeeded (110 to 144 s clean); the app starts and creates a real window on `macos-latest` (`macos-26-arm64`, 26.7.2) with no extra setup. The `.dmg` also built on the runner without trouble. The bundle is unsigned and was not opened by Gatekeeper (the test launches the inner binary). 
- **Cold start (spawn to the first WebKit process present, shipped binary, no driver):** 205 to 947 ms over 15 samples in the CI runs (latest 556, 324, 260, 284, 331). Not Electron's definition (launch to ready, 808 to 1,188 ms there).
- **G3 scenario:** 15/15 in the latest runs, twice in a job and across four or five workflow runs; the first run failed the dialog test because of my own test bug (see Corrections). Dialog opens with focus on Cancel (AX reports `AXApplicationDialog` and Cancel focused), Tab cycles (OS key events), Escape closes. **Real OS key events work on the hosted runner**: `osascript` with System Events `key code` ran without error; `AXIsProcessTrusted` returned true in the AX dump, so the runner grants the accessibility permission. Not run: native menu bar (not required), drag from the desktop, native dialogs.
- **Screenshots:** every page, light and dark, plus the dialog: `tauri/evidence/ci/slice-macOS/shots/darwin/` (11 files); uploaded as the `slice-macOS` artifact. Cross-run comparison at 0.1% tolerance: in-job 0 failures, against the previous workflow run 0 failures (latest runs). The runner's screen is small, so screenshots are about 1024 px wide.
- **Memory:** F1 above. App-only 28 to 33 MB; all processes 89 to 641 MB.
- **Network observation (measured, moderate to low confidence):** see `RESULTS.md`, Privacy, macOS: `tcpdump` for the whole job (132,038 packets, not attributable), `lsof -i` every 3 s over 5 minutes: only the app's own `127.0.0.1:4445` WebDriver listener, no non-loopback socket from the app or the WebKit helpers.
- WebKit version recorded per run: macOS 26.7.2 / WebKit 21624.5.1.11.3 (the user agent says `AppleWebKit/605.1.15`, a frozen string).

## F3. Platform accessibility

Dumps are raw text under `tauri/evidence/ci/a11y-<OS>/a11y-platform/<os>/` (six states each: `01-overview-nav`, `02-transactions-no-selection`, `03-transactions-row-selected`, `04-transactions-scrolled-far`, `05-reporting`, `06-dialog-open`). The dumpers are the Electron slice's own scripts (`atspi-dump.py`, `uia-dump.ps1`, `ax-dump.swift`), unchanged. Driven by `tauri/e2e/specs/a11y.e2e.ts` through the same WebDriver as the other tests. Chromium's tree for the same elements is in the Electron slice's `evidence/a11y-platform/`.

How the tree was switched on: Linux needed `dbus-run-session` with `at-spi-bus-launcher`, `at-spi2-registryd`, `ACCESSIBILITY_ENABLED=1` and `GTK_MODULES=gail:atk-bridge` (`scripts/atspi-wrap.sh`); WebKitGTK then publishes its tree without app code. Windows needed nothing (UI Automation attaches to the WebView2 window). macOS: `AXIsProcessTrusted` was already true on the runner.

### Linux (AT-SPI, WebKitGTK 2.52.6) — measured

| Element | Role | Name | Value / state | Notes |
| ------- | ---- | ---- | ------------- | ----- |
| Navigation item, Settings | push button | `Transactions`, `Settings` | FOCUSABLE, ENABLED; the open page's item is FOCUSED | inside a `landmark` named "Main navigation" |
| Top-bar Menu button | combo box (!) | `Menu` | FOCUSABLE | exposed as a combo box with action `select`, not a button |
| Search box | entry | `Search transactions` | EDITABLE, FOCUSABLE | |
| Filter drop-down | combo box with a `menu` of `menu item` children | `Account filter`, `Category filter` | the chosen option has state SELECTED | all 7 / 28 options are exposed |
| Grid container | table | `Transactions` | attrs `rowcount=10001;colcount=5`, `TABLE rows=30 cols=5`, MULTISELECTABLE | **announces 10,001 rows**; only about 30 are in the DOM (41 after a far scroll) |
| Column header | column header | **empty** | `sort=ascending` / `none` | the sort state is exposed; the header text is in a child, the header node's own name is empty |
| Data row | table row | **empty** | `rowindex=5`, `id=row-tx-00004`; SELECTED when selected | row has no name, unlike Chromium where the row was named from its cells |
| Cell | table cell | **empty for 4 of 5 cells**; the Description cell is named | `rowindex` only; no column index in the dump | Description has a `title` attribute and that is what gives it a name; the other cells have an unnamed `section` child |
| Selected row | table row | | **SELECTED** | `row-tx-00004` after the click; other rows only SELECTABLE |
| After scroll | | | `rowindex=5547` on the first rendered row, `rowcount` still 10001 | the DOM window moves; indexes stay global |
| Details panel | not inspected row by row | | | present in the tree (`03-…` dump) |
| Legend row | push button | `Housing: $27,090, 31 percent. Show transactions` | FOCUSABLE; action `press` | 34 matching buttons across the legend and month table |
| Dialog | dialog | `Reset settings?` | **MODAL**, FOCUSABLE; **focus on `Cancel`** (FOCUSED) | heading level 2, Cancel and Reset buttons |

I did **not** inspect the AT-SPI Text interface, so I cannot say whether the empty-named cells expose their text another way. The dump shows the name only.

### Windows (UI Automation, WebView2 156) — measured

| Element | Control type | Name | Value / state | Notes |
| ------- | ------------ | ---- | ------------- | ----- |
| Window | Window | `Folio`, class `Tauri Window`, containing `WRY_WEBVIEW` and the Chrome widget panes | focused | the WebView2 content appears under `Chrome_WidgetWin_1` |
| Menu button | Button | `Menu` | | |
| Search box | Edit | `Search transactions` | VALUE='' | |
| Filter | ComboBox | `Account filter` | | |
| Grid container | DataGrid | `Transactions` | `GRID rows=10001 cols=5`, TABLE rows=10001 cols=5 | **10,001 announced** |
| Column header | DataItem | `Date`, `Description`, … | GRIDITEM row=0 col=0..4 | has row and column index |
| Data row | DataItem | `2026-01-01 Amazon.ca Marketplace #9770 Rewards Visa Online -$239.51` (whole row, from its cells) | id `row-tx-00004`; **SELECTED=True** on the selected row | row name carries date, description, account, category and amount |
| Cell | DataItem | `2026-01-01`, `Amazon.ca …`, `Rewards Visa`, `Online`, `-$239.51` | GRIDITEM row=1 col=0..4, SELECTED | each cell named, with index |
| After scroll | | | first rendered row `row-tx-05546`; rows=10001 unchanged | |
| Details panel | Group | `Transaction details` | | |
| Legend row | Button | `Housing: $27,090, 31 percent. Show transactions` | focusable | |
| Dialog | Window (class `fui-DialogSurface`) | `Reset settings?` | `Cancel` Button focused=True | title as Text |

This matches Chromium's tree closely, as expected: WebView2 is Chromium. **Extra:** the UIA tree also contained an Edge-style `TabItem` named `Folio - Memory usage - 48.4 MB` (class `EdgeTab`), part of the WebView2 browser chrome; it is not app content.

### macOS (AX API, WKWebView) — measured

| Element | Role | Title / description | Value / state | Notes |
| ------- | ---- | ------------------- | ------------- | ----- |
| Menu button, month picker | AXPopUpButton | `Menu`, `Month (placeholder)` | value `March 2026` for the picker | Menu exposed as a pop-up button |
| Search box | AXTextField | `Search transactions` | | |
| Filter | AXPopUpButton | `Account filter` | value `All accounts` | |
| Grid container | AXTable | `Transactions` | **`rows=23 columns=5` (33 after a scroll)**: the count of *rendered* rows, **not 10,001** | `aria-rowcount` is not reflected in the AX row count |
| Column | AXColumn | | index, rows=23 | |
| Data row | AXRow | no title | index 4; **`selected=true`** for the selected row | index is the position among rendered rows |
| Cell | AXCell | description in `desc` for the Description cell; each cell has an `AXStaticText` child whose value is the text (`2026-01-01`, `Amazon.ca Marketplace #9770`, `Rewards Visa`) | rowRange/colRange given | all five values are exposed through the static-text children |
| Legend row | AXButton | `Housing: $27,090, 31 percent. Show transactions` | | |
| Dialog | AXGroup, subrole **AXApplicationDialog** | `Reset settings?` | **focus on the `Cancel` AXButton**; heading, body text and both buttons listed | |

### Plain-words answer (screen-reader user)

- **Windows (WebView2):** yes. A user can find a transaction by moving through a grid announced as 10,001 rows by 5 columns, hear a row as "date, description, account, category, amount", and know which row is selected; the dialog is named and focus lands on Cancel. It matches the Electron/Chromium result.
- **macOS (WKWebView):** mostly. Every rendered cell's text is exposed and the selected row says so, and the dialog is a proper application dialog with focus inside. **Missing: the table is announced as 23 rows (the rendered window), not 10,001**, so a VoiceOver user does not learn the size of the table and navigation across the virtualised window is by rendered row, not by position in the data. I did not test with VoiceOver.
- **Linux (WebKitGTK):** partly. The grid is announced as 10,001 by 5, the selected row is marked SELECTED, the legend rows are named buttons and the dialog is modal with focus on Cancel. **Missing in the dump: names on rows, column headers and four of five cells**, which Chromium gave. Orca may still read the text through the Text interface (not tested), so I cannot call this a failure, only a difference that needs a check with Orca.
- What no platform dump can tell me: whether a person finds the interaction model usable. The grid is the Electron slice's "not a fully ARIA-compliant grid" (the scroll area is the focus target, arrow keys select rows); that is renderer code and is unchanged.

**Stretch (screen reader in CI):** **not attempted** (about 30 minutes were not left; NVDA through Guidepup on the Windows runner, VoiceOver and Orca untested).

## Stack-specific items

The kickoff prompt's own measurement list is covered in `RESULTS.md` and `TAURI-FINDINGS.md`: G1 captures per OS, G3 per OS, packaging and sandbox, web view pinning, Rust extras. Not done: the optional CEF trial (see `TAURI-FINDINGS.md`).

## Effort

About 3.5 hours wall clock for the whole slice plus follow-up in one pass; no prompts or corrections after the kickoff. See `EFFORT-LOG.md`.

## Not measured

- Memory with a screen reader attached (all OSes), and with a real GPU or Wayland (Linux).
- A second, independent method for finding macOS WebKit helpers.
- Soak longer than 20 scrolls; more than three CI runs per OS.
- Orca, VoiceOver and NVDA (no screen reader run); the AT-SPI Text interface; macOS HiDPI.
- Windows traffic sent by system services and Windows' own diagnostic data (not visible from the runner); results for the WebView2 controls are in `RESULTS.md`.
- Safari 16-era engines, old WebKitGTK versions, Windows 10 without WebView2.
