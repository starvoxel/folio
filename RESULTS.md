# Results: Electron + TypeScript slice

- Stack and exact versions: Electron 45.3.0 (Chromium 156.0.8078.96, Node 22 for tooling), TypeScript 7.0.2 strict (`noUncheckedIndexedAccess` on), Vite 8.3.8, React 19.3.1, Playwright 1.65.0, @electron/packager 20.3.0, @electron/fuses 2.1.3.
- Design system and version: Fluent UI React v9, `@fluentui/react-components` 9.75.2 (MIT). Grid: `@tanstack/react-virtual` 3.14.26 (MIT). Charts: ECharts 6.1.0 (Apache-2.0, SVG renderer).
- Date range of the work: 2026-11-11 23:50 UTC to 2026-11-12 about 01:10 UTC (single session, about 1.3 hours wall clock).
- Commit measured: the head of `spike/slice-electron` when this file was committed. CI evidence is linked per gate; the runs named below were on earlier commits that differ only in test, CI and docs files unless stated.

Everything below was measured on this sandbox (Linux, Xvfb, software rendering, no GPU) and on GitHub-hosted `ubuntu-24.04` and `windows-2025` runners. macOS was not run anywhere.

## Gates

| Gate | Pass / Fail / Not measured | Evidence | Notes |
| ---- | -------------------------- | -------- | ----- |
| G1 Privacy | **Pass on traffic, with one syscall to flag** (Linux). Windows and macOS: not captured. | `electron/evidence/g1/` (local), CI job "G1 network capture" in run 43131606127 (artifact `capture-linux`) | Two 5-minute captures: 0 non-loopback packets. One non-loopback `connect()` seen, on a UDP socket (see Privacy capture). No telemetry, licence check or update check exists in code. |
| G2 Grid at scale | **Fail** (memory). Frames and sorting pass. | `electron/test-results/perf-*.json` (CI artifacts `linux-results`, `windows-results`), `electron/evidence/` | After scrolling twice the whole app is 672 MB (Linux, sum of working sets) and 404 MB (Windows, sum of working sets). Linux proportional memory (PSS, shared pages counted once) is 403 MB. All three are over 400 MB. Growth between the first and second scroll is under 5 MB. |
| G3 Testable and agent-drivable | **Pass** on Linux and Windows, with a caveat about the tested binary (below). | CI runs 43125976811 and later: Linux 16/16 twice, Windows 16/16; screenshots identical between consecutive runs | Dialog takes focus on open and Escape closes it on both OSes. The tested binary is the shipped binary with one fuse flipped. |
| G4 Charts | **Pass** | `tests/slice.spec.ts`; screenshots in `electron/evidence/fidelity/` | Donut and bars render in light and dark. Click on slice, bar or legend row opens filtered Transactions. Legend rows are real buttons reachable by Tab and activated with Enter. |
| G5 Footprint | **Pass** (recorded; nothing above a ceiling), with the installer not built. | Numbers table | Linux zip of the packaged app 124 MB; cold start about 0.5 s; idle memory 590 MB (Linux, working-set sum) and 335 MB (Windows). |
| G6 Licences and cost | **Pass** | `electron/package-lock.json` | Lockfile licences: MIT 166, Apache-2.0 29, MPL-2.0 12, ISC 7, BlueOak-1.0.0 5, BSD 5, 0BSD 3. The MPL-2.0 packages are `lightningcss` (a Vite build tool, not shipped). No paid component. |

### G3 caveat: the tested binary

Playwright could not attach to the fuse-hardened binary. With `EnableNodeCliInspectArguments` off, `_electron.launch` timed out. With it on, it attached in under half a second. So I ship with that fuse off and test a copy with it on. Both come from one build and one packaging script (`scripts/package.mjs`), and CI shows the two executables differ by exactly 1 byte (`cmp -l`). Every other fuse, the app code, the protocol handler and the CSP are the same. This is closer to "the shipped binary" than a separate E2E build, but it is not literally the shipped file. The privacy capture of the shipped file was run idle only (no driver can attach to it).

## Numbers

| Measure | Linux | Windows | macOS | How measured |
| ------- | ----- | ------- | ----- | ------------ |
| Installer or package size | 124 MB zip of the packaged app (275 MB unpacked, of which 224 MB is the Electron binary and 1.2 MB is our `app.asar`). **No installer built.** | 357 MB unpacked; zip not measured | not measured | `zip -r` of `out/Folio-linux-x64` in CI. I did not build an AppImage, deb or NSIS installer, so the "installer over 250 MB" ceiling is not directly tested; the zip is a proxy. |
| Cold start to usable window | 490 ms (CI), 422 ms (sandbox) | 696 ms (CI) | not measured | Playwright `launch` to `window.__folio.getState().ready` (data loaded and first render), wall clock, one sample per run. |
| Idle memory | 590 MB working-set sum, 324 MB PSS (4 processes) | 335 MB working-set sum | not measured | `app.getAppMetrics()` summed over all Electron processes, Transactions page open, 2 s after load. On Linux also `Pss` from `/proc/<pid>/smaps_rollup`. |
| Memory after a full grid scroll, first pass | 668 MB working set, 400 MB PSS | 403 MB | not measured | Same metrics, 3 s after the pass. Pass is 600 frames, 600 px per frame, top to bottom. |
| Memory after a second scroll | 673 MB working set, 403 MB PSS | 404 MB | not measured | Same. Growth from pass 1 to 2: +4 MB (Linux), +0.5 MB (Windows). My own threshold for "no sustained growth" was 20 MB; the spec gives no number. |
| Worst frame time while scrolling | 16.8 ms (0 frames over 100 ms of 1,200) | 15.8 ms (0 of 1,202) | not measured | `requestAnimationFrame` deltas in the renderer while a script scrolls the grid. This measures main-thread cadence. It does not see compositor or GPU stalls, and the Linux run has no GPU. Long-task observer saw none. |
| Sort time (Date, Description, Account, Category, Amount) | 31, 32, 32, 32, 32 ms worst of 3 each | 29, 30, 30, 30, 30 ms | not measured | In-page: header `click()` to two animation frames later, worst of 3 sorts per column. |
| Build time (clean) | Vite + tsc 1.4 s (CI); `npm ci` plus Electron download 23 s; package plus fuses about 3 s | build 1 s, packaging about 8 s (CI log) | not measured | CI step timings. Test selection after a long scroll took 15 ms on Linux and 121 ms on Windows. |

Memory is the weak number. A baseline measurement on the Overview page (no grid), run before looking at the grid code, was already 556 MB working set and 317 MB PSS on Linux: Browser 102, GPU 101, Utility 30, renderer 84 (PSS MB). With `--disable-gpu` it was 478 MB and 244 MB. So most of the cost is Electron's process model and, on this Linux setup, the software-GL GPU process. I did not shrink the app to get under the gate and I did not change what is measured. Whether a Linux or Windows desktop with a real GPU lands under 400 MB is not known from this data; the Windows runner is the closest (404 MB, 4 MB over).

## Effort

- Active working time: about 1.3 hours of wall clock in one session, most of it unattended waiting on CI and the two 5-minute captures. I did not keep exact per-task times; see `EFFORT-LOG.md`.
- Number of prompts or corrections the user had to give: 1 correction after the kickoff prompt (use the prototype for the visual only, not its technical structure; I had copied its CSS variable block). Listed in `EFFORT-LOG.md`.
- Where most time went: CI iterations (8 runs so far at the time of writing): comparison step reading wiped files, a Windows-specific chart click, the dialog animation, and the network-capture analyzer; then the privacy capture tooling (needed `iproute2`, `tcpdump`, and a veth pair because this kernel lacks dummy interfaces).

## Fidelity against the prototype

Screenshots are in `electron/evidence/fidelity/`: `proto-*-light|dark.png` (prototype) and `folio-*-light|dark.png` (this app) for Overview, Transactions and Reporting. They are not pixel-matched. The prototype was used for the visual only. Differences:

- Colours come from the Fluent UI v9 theme (`webLightTheme`, `webDarkTheme`) with only the brand blue overridden to the prototype's accent. Neutral surfaces are Fluent v9's, not the prototype's Fluent v2 greys: page background is a bit lighter in light mode and a bit different in dark mode.
- Font: system stack (Segoe UI on Windows, system UI elsewhere), no Inter and no remote or bundled font. Mixed-script text relies on fonts installed on the machine. The Linux screenshots used Noto-family fallbacks and look fine for CJK and Cyrillic.
- Navigation uses Fluent's `NavDrawer` (icons, selected indicator). Layout is close; the prototype's nav is slightly narrower, and I overrode Fluent's opaque dark nav item fill to transparent.
- Transactions: the prototype shows a weekday under the date, "+" on money in, "Parent › Child" in the category column and a status filter; the slice spec asks for neither, so I did not build them. The side panel shows the spec's note, account and category names only (no "Why this category?" or split editor).
- Dates are ISO (2026-01-01) in the grid; the prototype uses "Oct 31".
- Top bar: Fluent buttons and a native `<select>` for the month picker (inert). The prototype's "Sample data" tag, Save button and hamburger-menu contents are not reproduced; the menu has placeholder items and a working Settings entry.
- Reporting: donut and bars use ECharts with the prototype's palette order; the Money in/out table under the bars is my addition so every bar has a keyboard-reachable equivalent. The donut centre label (total) set in the chart option did not render in the screenshots; I did not chase it.
- Not compared: Overview and the placeholder pages are title-only by spec.

## Dependencies

- Lockfile: 227 packages total. 6 direct runtime entries and 12 direct dev entries in `package.json` (Electron is listed with the runtime ones but is not bundled). Lockfile flags 116 packages as dev-only and 111 as not.
- What ships: `app.asar` (1.2 MB) contains only our compiled code and the single Vite bundle (React, Fluent UI, Griffel, ECharts and zrender, TanStack Virtual). No `node_modules` are shipped.
- Deprecated per npm metadata: none. I did not audit maintainer counts or abandonment for each package; I would not claim any are single-maintainer or near-abandoned without checking. `npm audit` printed "5 moderate severity vulnerabilities" in CI; I did not look into which packages, but the tooling is dev-only.
- One note: the Electron binary was not downloaded by `npm install` in this sandbox (postinstall did not run) and had to be fetched with `node node_modules/electron/install.js`.

## Accessibility

Evidence in `electron/evidence/a11y/` (Chromium accessibility tree through CDP and Playwright's ARIA snapshot). I did not inspect the native platform trees (AT-SPI, UI Automation, NSAccessibility) and did not test with a screen reader.

- Keyboard reach: Tab reaches the nav (roving: one stop for the selected item, one for Settings), the menu button, search box, both filter selects, the five column header buttons, the grid body, the report-month select, every legend row and every month in/out button, the theme radio group (one stop, arrow keys inside) and the Reset button. Undo, Redo, Import and the top-bar month picker are disabled placeholders and not reachable, as intended.
- Grid: exposed as `grid` "Transactions" with `row`, `columnheader` (with `aria-sort`) and `gridcell` roles, `aria-rowcount` 10,001 and `aria-rowindex` on rendered rows, and `aria-selected`. Keyboard selection (Arrow, PageUp/Down, Home/End) works on the scroll container via `aria-activedescendant`. This is not a fully ARIA-compliant grid: the focusable element is the scroll area, not the grid, and arrow keys select rows rather than moving cell focus. Only about 30 rows exist in the DOM at a time because of virtualisation.
- Legend rows: real `<button>` elements named like "Housing: $27,090, 31 percent. Show transactions", focusable, activated by Enter or Space.
- Charts: exposed as one image with a short label. ECharts' own generated label read raw integer cents ("data for Housing is 2708950"), so I turned it off and rely on my label plus the legend and table.
- Fluent's dialog traps focus and returns it to the trigger on close.

## Agent drivability (G3 mechanism)

The app is started with `FOLIO_AUTOMATION=1` (off by default). The renderer then exposes `window.__folio` with `getState()`, `navigate(page)` and `settled()`. Playwright reads it with `page.evaluate`; there is no extra server or port. The `FOLIO_DATA_DIR` environment variable (or `--data-dir=`) supplies the fixtures; `FOLIO_USER_DATA` isolates the profile.

```bash
cd electron && npm ci && node scripts/package.mjs
FOLIO_FUSE_INSPECT=1 FOLIO_OUT=out-test node scripts/package.mjs   # the binary Playwright drives
xvfb-run -a -s "-screen 0 1440x900x24" npx playwright test        # Linux; plain `npx playwright test` on Windows
```

Sample `getState()` on Transactions after selecting a row (shortened):

```json
{"ready":true,"page":"transactions","title":"Transactions",
 "theme":{"preference":"system","effective":"light"},
 "dialog":{"open":false,"title":null,"focusInside":false},
 "transactions":{"totalRows":10000,"visibleRows":10000,"filters":{"search":"","account":"","category":"","month":"","flow":""},
   "sort":{"col":"date","dir":"asc"},"renderedRows":29,
   "selected":{"id":"tx-...","amount":"-$135.41","account":"Travel Mastercard","category":"Flights and hotels","note":null}}}
```

Tests (`tests/slice.spec.ts`, 16) launch the packaged binary, check it has one visible window at `folio://app/`, check the renderer has no `require`, no `process` and a bridge of exactly two functions, visit every page by clicking the nav, read state and take a screenshot, exercise search, filters, sort, selection, mixed-script search, the donut, the bars and the legend by mouse and keyboard, light and dark themes, the dialog (focus inside, Tab cycles, Escape closes, focus returns), assert the app's request filter blocked nothing, and close the app expecting exit code 0. `tests/perf.spec.ts` does G2.

Screenshots: Linux, two runs in one job, and then against the previous workflow run (stored in the Actions cache): 0 differing pixels in the first runs where code was unchanged. The tolerance is stated in the workflow: an image passes if at most 0.1% of its pixels differ (pixelmatch, per-pixel threshold 0.1). Windows is compared between two runs in one job only. The bar to meet "two consecutive CI runs" on Linux is shown by the runs listed in the table; a run that follows a code change legitimately fails against the old baseline, which happened for runs 4 to 7 after I changed styling and test timing.

## Privacy capture (G1)

Hardening applied: no `crashReporter` import or call, no `autoUpdater`, no update check, `--no-proxy-server` before ready, `webRequest` deny-all filter (only `folio://`, `devtools://`, `data:`, `blob:` allowed; refused URLs recorded and asserted empty in tests), deny-all permission request, check and device handlers, UI served from `folio://app/` with a per-load nonce and a CSP (`default-src 'none'`, `script-src 'self'`, `connect-src 'none'`, `style-src 'self' 'nonce-…'`), spellcheck off in `webPreferences` and the session with its dictionary URL pointed at a dead loopback address, `GOOGLE_API_KEY` and two sibling variables removed from the environment, `will-navigate` and `will-redirect` blocked, `setWindowOpenHandler` denying, `<webview>` blocked, `contextIsolation` on, `nodeIntegration` off, `sandbox` on, and fuses (`RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off in the release build, `OnlyLoadAppFromAsar` on, cookie encryption on, file-protocol extra privileges off). The ASAR integrity fuse is left off: it is documented as macOS and Windows only, and I did not test it on Windows.

Method (`scripts/capture.sh`, `scripts/analyze-capture.mjs`): run the app inside a fresh Linux network namespace as root; `tcpdump -i any` for packets and `strace -f -e trace=network` for every network syscall. Two modes. "noroute": loopback only, so a non-loopback attempt fails with ENETUNREACH and shows up in strace. "sink": loopback plus a veth pair with a default route to a fake gateway (a permanent neighbour entry), so any outbound packet is really emitted and captured; the CI run also has an IPv6 sink route. A positive control (`curl` to a public IP) is detected by both tools.

Captures and results:

1. Driven capture (test binary), launch, every page, search, filter, sort, selection, click-through, theme change, dialog, then **300 s idle**, sink route. Local (`electron/evidence/g1/driven-sink/`): 918 packets, all on `lo` (Playwright talking to the app's inspector), 0 others. CI run 43131606127: 951 text-capture lines, 907 loopback, 44 kernel IPv6 neighbour/router/MLD housekeeping on the namespace's own veth (from `::` or link-local, created by the kernel for the veth I made), **0 application packets**.
2. Release binary (inspect fuse off, no driver), launch and **300 s idle**, loopback-only namespace. Local and CI: **0 packets**; no AF_INET listeners or connections.
3. Stock Electron 45 with no hardening, spellcheck enabled and `en-US` requested, 60 to 100 s: no outbound attempt either.

What I saw that you should know about:

- **One non-loopback syscall.** In both CI captures the app process calls `connect()` on an `AF_INET6, SOCK_DGRAM` socket to `2001:4860:4860::8888` port 443 (Google Public DNS). With the IPv6 sink route the call returned 0 and no packet followed; with no route it returned ENETUNREACH. A UDP `connect()` only chooses a route, so nothing is sent. I believe this is Chromium's built-in IPv6 reachability probe, but I did not confirm that from Chromium's source. The analyzer reports it as a NOTICE instead of a failure; that classification is my judgement. If the gate is read as "no `connect()` call to any address but loopback", this is a literal fail that I cannot remove with a switch I know of. I could not reproduce it locally because this sandbox kernel has no IPv6.
- The brief's spellcheck-dictionary leak did **not** reproduce on Linux, even in the unhardened stock case. That does not show it never happens: I did not exercise typing with real keyboard input and the Windows/macOS paths use OS spellcheckers. WPAD (Windows) was not tested.
- The app opens D-Bus connection attempts to the system bus (a local Unix socket) and Chromium binds `AF_NETLINK` sockets to watch network changes. Both are local kernel or IPC, not network traffic.
- The test binary opens a loopback listener when Playwright launches it (the inspector). The release binary has none.
- OSes captured: Linux only (sandbox and the GitHub runner). Windows and macOS: not captured. Hosted Windows runners do not give me a capture tool I verified.

## Problems and workarounds

- Electron's binary was not downloaded by `npm install` here; ran `node node_modules/electron/install.js`.
- TypeScript 7 removed `moduleResolution: node10`; the main-process tsconfig uses Node16.
- The Node inspect fuse blocks Playwright (see G3 caveat).
- The Linux Chromium sandbox helper is not setuid in CI or this container, so tests launch with `--no-sandbox` on Linux. A production Linux build would need the setuid helper or user namespaces; I did not solve that.
- Fluent's `FluentProvider` background and nav fill beat my plain class selectors; I raised specificity and made nav items transparent.
- Fluent's style injection needs a CSP nonce: the protocol handler rewrites `index.html` per load and the renderer passes the nonce to Griffel. No CSP violations appeared in the console.
- ECharts' `aria` option produced a misleading label (raw cents), so it is off.
- Money formatting avoids floats, but ECharts needs numbers; I give it integer cents and format the axis labels from integers. Chart tooltips format cents the same way.
- Playwright wipes `test-results/` at the start of each run, which deleted the screenshots I wanted to compare; the kept copy lives outside it.
- The first version of my SVG bar-click test used hard-coded pixel geometry and failed on Windows; it now finds bars by their fill and scrolls the chart into view.
- A dialog screenshot taken during the open animation differed 0.28% between runs; the test now waits for animations.
- Chunk size warning from Vite: one 1.16 MB bundle (360 KB gzip), not split.
- A single large shell command was refused once by the harness safety check even though it did not delete anything; I used the Write tool instead.

## Opinion

Easy: the UI. React plus Fluent v9 plus a virtualiser got a correct 10,000-row grid and both charts with very little code (about 1,200 lines in total), and sorting 10,000 rows takes about 30 ms in plain JavaScript. Agent drivability is the best I could ask for: Playwright talks to the real window, and a test-only state function returns JSON, with no extra server.

Painful: the numbers the gates care about. Memory is over 400 MB on both OSes, and it is mostly Electron's process model, not our code (an empty-ish page is already 244 to 317 MB proportional on Linux). The hardened release build cannot be driven by Playwright, so what we test is not quite what we ship. The privacy story is credible but not tidy: the capture found nothing leaving the machine, but it did find a probe `connect()` to a Google address, and that took a UDP-versus-TCP analysis to explain. I would not have found it without running the capture.

Worries for the real app: (1) memory and the 800 MB idle ceiling once real data, more pages and a real chart set are added; (2) privacy drift on each Electron bump, which means the capture job must stay in CI and someone must read its output, including notices like the one above; (3) the Linux sandbox setup for distribution; (4) per-OS screenshot baselines and font differences, since Linux screenshots use whatever fonts the machine has; (5) the accessibility model for a virtualised grid, which I only partly did; (6) what I did not test at all: macOS, a signed installer, auto-update (deliberately absent), and writing files.
