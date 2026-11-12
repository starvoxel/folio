# Follow-up results: Electron slice

Branch `spike/slice-electron`. Everything below is marked **measured**, **not measured** (with a reason) or **inferred**. Raw evidence is under `electron/evidence/`. `RESULTS.md` is unchanged; where it was wrong, this file says so.

Runners: GitHub-hosted `ubuntu-24.04` (kernel 7.0.0-azure), `windows-2025`, `macos-latest` (= `macos-26-arm64`, Apple silicon). Workflow: `.github/workflows/electron-followup.yml`. CI runs referred to: **A** = 43141226732 (first complete run), **B** = 43143846729 (final complete run, all jobs green), **C** = 43146938083 (screen reader job only). Local numbers come from the dev sandbox (Linux 6.18, Xvfb, software rendering, no IPv6, root user).

## Corrections to RESULTS.md

1. **The "UDP probe" was caused by my own code, and the hardening hid a real leak.** `RESULTS.md` (Privacy capture) said the one non-loopback `connect()` was probably Chromium's IPv6 reachability probe and that the brief's spellcheck-dictionary leak "did not reproduce". Both statements were wrong for what I shipped. The only network request the app made was Chromium's **spellcheck dictionary download**; my hardening redirected it to `http://127.0.0.1:9/` with `setSpellCheckerDictionaryDownloadURL`, which is why the capture showed no packets, and that single request is what triggered the probe. With only `setSpellCheckerEnabled(false)` (what the brief's hardening set implies), the app **looks up and requests `redirector.gvt1.com` (Google's CDN) at startup** (E1): 42 outbound DNS queries in a captured namespace, and on a connected machine the HTTPS request goes through and is redirected to a second `gvt1.com` host. It is fixed in this branch with `setSpellCheckerLanguages([])`. The earlier "G1 pass" was true of the build as shipped, but the safety came from an accident of the redirect, not from understanding. My claim that the deny-all `webRequest` filter would stop such requests was also wrong: it does not see this request.
2. **Memory (G2) undercounted Linux.** `RESULTS.md` summed `app.getAppMetrics()` (4 processes), which omits Chromium's zygote helper processes. A whole-process-tree PSS sum (6 processes) is higher: **441 MB at P2** (first full scroll) on the CI runner versus 400–403 MB in `RESULTS.md` for the same scenario. The Linux PSS figure was therefore over the 400 MB limit by more than the 3 MB `RESULTS.md` suggested.
3. **The donut centre label and the bar-chart legend were my mistake, not a library limit.** I tree-shook ECharts and never registered `TitleComponent` and `LegendComponent`. Registered now (`src/renderer/Charts.tsx`); the centre total and the legend render.
4. **The `--no-sandbox` explanation was incomplete.** In this container the sandbox only failed because I ran as root. On `ubuntu-24.04` as an ordinary user it fails for a different reason (AppArmor restricts unprivileged user namespaces). See E2.
5. **ASAR integrity fuse on Windows** was listed as untested; it was left off. It works (E5).
6. **Dependency/audit facts.** `RESULTS.md` said `npm audit` reported 5 moderate findings. Identified in E5. The count is now 9 only because I added `electron-builder` (a dev tool) for the installer and sandbox tests.

## F1. Memory, same method

**Metric per OS (measured):**
- Linux: sum of **PSS** over the app's whole process tree (root process and every descendant) with `tools/measure-memory.py <root-pid>`; summed RSS recorded beside it.
- Windows: sum of **private working set** per process (`WorkingSetPrivate` from `Win32_PerfFormattedData_PerfProc_Process`, which is the "Working Set - Private" counter), over the whole tree found from `Win32_Process.ParentProcessId`; the same query's `WorkingSet` (total working set, shared pages counted in every process) is the reference column.
- macOS: sum of **physical footprint** from `footprint -p <pid>` per process in the tree (`ps -axo pid,ppid`); summed `ps` RSS beside it.
- Code: `electron/scripts/memtree.mjs` (metrics), `electron/scripts/mem-points.mjs` (scenario). Commands: `node scripts/mem-points.mjs <test exe> out.json [--a11y]` (Linux under `xvfb-run -a`). The binary is the packaged build with only the inspect fuse flipped, as in `RESULTS.md`.
- Scenario: P0 Overview 5 s after ready; P1 Transactions 5 s after navigating; P2/P3/P4 after scrolls 1/2/3 (600 frames of 600 px each; 3 s after, and 60 s idle for P4); P5 = 20 more full scrolls where, before each, one sort changes and the category filter is set and then cleared (so every scroll covers all 10,000 rows), then 60 s idle.
- Accessibility off for these headline numbers; second table has Chromium accessibility forced on (`--force-renderer-accessibility`).

**Headline table, accessibility off (measured, CI run B).** Run A gave values within 4 MB for Linux and Windows at every point (and within 10 MB on macOS), so the figures are stable on the hosted runners.

| Point | Linux PSS (MB) | Linux RSS (MB) | Windows private WS (MB) | Windows total WS (MB) | macOS footprint (MB) | macOS RSS (MB) |
| ----- | -------------- | -------------- | ----------------------- | --------------------- | -------------------- | -------------- |
| P0 Overview, 5 s | 350.3 | 715.2 | 95.5 | 313.3 | 122.8 | 449.3 |
| P1 Transactions, 5 s | 367.5 | 740.3 | 104.2 | 332.9 | 140.8 | 470.1 |
| P2 after scroll 1 | **440.7** | 817.4 | 160.8 | 395.4 | 205.8 | 541.8 |
| P3 after scroll 2 | 428.9 | 805.9 | 161.4 | 395.1 | 199.8 | 537.3 |
| P4 after scroll 3 + 60 s idle | 360.3 | 735.9 | 103.2 | 305.3 | 129.6 | 485.0 |
| P5 after soak | 379.0 | 754.7 | 66.8 | 140.5 | 142.6 | 497.1 |

Process counts: Linux 6, Windows 5, macOS 4. Windows total working set at P5 (140 MB) is low because Windows trims idle working sets; the private working set is the steadier figure.

**Against the 400 MB G2 limit, per metric (measured; "after scrolling" read as the worst of P2 to P5, shown per point):**

| Metric | Worst point | Verdict at 400 MB |
| ------ | ----------- | ----------------- |
| Linux PSS | 440.7 (P2); P3 428.9; P4 360.3; P5 379.0 | **Fail** at P2 and P3, pass at P4 and P5 |
| Linux RSS sum | 817.4 (P2) | Fail |
| Windows private working set | 161.4 (P3) | Pass |
| Windows total working set | 395.4 (P2), 395.1 (P3) | Pass by 4.6 MB (marginal) |
| macOS physical footprint | 205.8 (P2) | Pass |
| macOS RSS | 541.8 (P2) | Fail |

Which metric the limit applies to is for Jeremy. The numbers differ by metric by a factor of 2 to 4 on the same app, which matters more than any single verdict.

**With Chromium accessibility forced on (measured, CI run B; the points that matter):**

| Point | Linux PSS | Windows private WS | Windows total WS | macOS footprint |
| ----- | --------- | ------------------ | ---------------- | --------------- |
| P2 | 437.3 | 170.0 | **407.3** | 203.7 |
| P3 | 432.8 | 160.3 | 395.7 | 198.7 |
| P5 | 377.2 | 71.7 | 148.7 | 140.6 |

Forcing accessibility on changed nothing measurable on Linux or macOS (differences within run-to-run noise) and added about 10 MB at the Windows peak, enough to move Windows total working set from 395 MB to 407 MB, i.e. over 400 MB at P2. Full per-point tables for both sets and both runs: `electron/evidence/f1/ci/` and `electron/evidence/f1/`.

**Growth over the soak (P3 to P5):** none. Linux PSS 428.9 to 379.0 MB, Windows private WS 161.4 to 66.8 MB, macOS footprint 199.8 to 142.6 MB. Memory rises during scrolling (DOM churn and V8 heap) and falls back after the idle period; the end-of-soak value is at or below the P1 value plus about 15 MB on Linux and macOS. Not measured: soak beyond 20 scrolls.

Local sandbox repeat for the Linux metric (same code, not CI): P2 440.7, P3 430.4, P5 347.2 (`evidence/f1/linux-default.json`). A later local baseline run of the current build gave P3 of 397.6, 403.8 and 404.0 MB across three runs (E4), i.e. the same build sits near the limit locally and 29 to 33 MB above it on the CI runner. Differences of about 30 MB between machines are normal here.

## F2. macOS

**Measured, run B.** It works on a free hosted runner.
- Build and start: `@electron/packager` produces `Folio.app` for `darwin-arm64`; fuses flip with `resetAdHocDarwinSignature`. The app **starts and creates a real window** on `macos-26-arm64` with no logged-in user problem. Packaging takes about 3 s.
- Cold start to usable window (same definition as `RESULTS.md`): **1,188 ms** with Playwright's Electron driver, **808 ms** with the pipe driver on the exact release binary (first launch includes cold disk cache; one sample each). Linux 884/476 ms, Windows 683/643 ms for comparison.
- G3 scenario on macOS: **all tests pass with both drivers** (Playwright Electron driver: 17 passed, the 16 slice tests plus the `guard` test; pipe driver on the exact release binary: 16 passed and 1 skipped, the skipped one needs main-process access). That includes navigation to every page, structured state reads, screenshots, search, filters, sorting, selection, mixed-script search, donut and bar click-through, legend by keyboard, light and dark themes, the dialog (focus lands inside, Tab cycles, Escape closes, focus returns) and a clean exit with code 0. Key events are injected by Playwright through the DevTools protocol, not by the operating system, so "real" OS-level key delivery was not tested except in the screen reader attempt below. Nothing in G3 failed to run on macOS.
- Screenshots of every page in light and dark are artifacts of run B (`g3-macOS`); a set is in `electron/evidence/f2-macos/screenshots/`.
- Native menu bar: not required, not done.

**Network observation (measured, low confidence).** `tcpdump -i any` for launch, every page and 300 s idle (`scripts/mac-net.sh`, run `mac-network` artifact), plus `lsof -i` sampled every 5 s for sockets of `Folio` processes.
- `lsof` saw exactly one socket held by the app: `127.0.0.1:<port> (LISTEN)`, the Playwright inspector port of the test binary. **No non-loopback socket from the app in any 5 s sample.**
- The packet capture is 1.4 GB, dominated by the runner's own traffic (GitHub, Azure, Apple); the capture format carries no process names, so **packets cannot be attributed to the app**. There were no DNS packets in the capture at all (name resolution on macOS is handled by the system resolver, which `tcpdump` on the hosted VM did not show), so I could not look for a Google CDN lookup either.
- Confidence: moderate that the app made no outbound connection that lasted longer than about 5 s; low for short-lived ones. This does not replace the Linux capture. The spellcheck dictionary download that leaked on Linux is a Linux-only behaviour in Electron (macOS and Windows use the OS spell checker), inferred, not tested.

## F3. Platform accessibility

Scenario for every OS (`scripts/a11y-platform.mjs`): app started with accessibility forced on, then dumps taken on Overview, Transactions with no selection, Transactions with row 4 selected, Transactions scrolled to the end, Reporting, and the confirmation dialog open. Raw dumps (full trees, up to 2,500 nodes each): `electron/evidence/a11y-platform/{linux,linux-ci,windows,macos}/`.

### Linux: AT-SPI (measured; dbus session + `at-spi-bus-launcher` + `at-spi2-registryd`, Xvfb, python3-gi/Atspi)

To make the app publish a tree I had to start an AT-SPI bus (`dbus-run-session`, `at-spi-bus-launcher --launch-immediately`, `at-spi2-registryd`), set `toolkit-accessibility`, and launch with `--force-renderer-accessibility` and `ACCESSIBILITY_ENABLED=1`.

| Element | Role | Name | State / value | Notes |
| ------- | ---- | ---- | ------------- | ----- |
| Nav item "Transactions" | push button | Transactions | FOCUSABLE | Actions: press. The nav is a `landmark` named "Main navigation" |
| Settings footer item | push button | Settings | FOCUSABLE | same |
| Top-bar menu button | push button | Menu | FOCUSABLE | Not reported as a menu button (no haspopup) |
| Search box | entry | Search transactions | FOCUSABLE, EDITABLE | placeholder not exposed as name |
| Account / Category filter | combo box | Account filter / Category filter | children `menu item` options with `posinset` and `setsize` (7 and 28) | native `<select>` |
| Grid container | table | Transactions | attrs `rowcount=10001`, `colcount=5`; **Table interface reports 30 rows** (41 after scrolling), i.e. only rendered rows | the 10,000-row size is available only as the ARIA attribute |
| Column header | column header | Date etc. | attr `sort=ascending` on Date | each contains a push button |
| Data row | table row | "2026-01-01 Aeroflot Аэрофлот #4389 Travel Mastercard Flights and hotels -$135.41" | FOCUSABLE, SELECTABLE; **selected row has SELECTED and FOCUSED** | Row name concatenates all cells |
| Cell | table cell | e.g. "-$135.41" | none | cell-level row/column index not reported; after scrolling rows carry `rowindex=5547` |
| Details panel | landmark "Transaction details" with a description list | heading = description, amount, then terms and values (Date, Account, Category, Note) | | A heading sits inside the `dl`, which is invalid HTML; screen readers still read it |
| Donut legend row | push button | "Housing: $27,090, 31 percent. Show transactions" | FOCUSABLE | Actions: press |
| Charts | image | "Donut chart of spending by main category. Use the legend list…" | | one node each; slices are not exposed individually |
| Dialog | dialog | Reset settings? | MODAL | heading level 2; **focus: Cancel button (FOCUSED)** |

As the grid scrolls the set of rendered rows changes (30 to 41 rows in the tree), the table's Table-interface row count follows the rendered rows, and the ARIA attribute stays 10001.

### Windows: UI Automation (measured; `System.Windows.Automation`, `scripts/uia-dump.ps1`)

The first attempt found no window because the top-level window belongs to a different process id than the one Playwright reports; the script now falls back to the `Chrome_WidgetWin_1` window named Folio.

| Element | Control type | Name | Patterns / state | Notes |
| ------- | ------------ | ---- | ---------------- | ----- |
| Nav items, Settings, Menu button | Button | Transactions, Settings, Menu | focusable | Menu has no expand state |
| Search, filters | Edit, ComboBox with option items | Search transactions; Account filter | | |
| Grid container | **DataGrid** | Transactions | **GridPattern and TablePattern rows=10001 cols=5** | the full size is announced |
| Column header | DataItem | Date etc. | GridItem row 0, column 0 to 4 | |
| Data row | DataItem | whole-row text | focusable; **SelectionItem IsSelected=True for the selected row**, focused=True | |
| Cell | DataItem | "-$135.41" | GridItem row=1 col=4; after scrolling to the end `row=5546` (absolute index) | absolute, not relative to rendered rows |
| Details panel | Group "Transaction details" with Text items | | | |
| Legend row | Button | "Housing: $27,090, 31 percent. Show transactions" | | |
| Dialog | Window | Reset settings? | | **focused element: Cancel button (HasKeyboardFocus=True)** |

### macOS: AX API (measured; `scripts/ax-dump.swift`; `AXIsProcessTrusted()` was **true** on the hosted runner, so the permission was granted)

| Element | AX role | Title / value | State | Notes |
| ------- | ------- | ------------- | ----- | ----- |
| Nav item, Settings, Menu | AXButton / AXPopUpButton (Menu) | Transactions, Settings, Menu | | nav is `AXLandmarkNavigation` "Main navigation" |
| Search box | AXTextField | Search transactions | | |
| Filters | AXPopUpButton | Account filter, value "All accounts" | | |
| Grid container | **AXTable** | Transactions | **rows=33 (rendered rows only), columns=5** | **the 10,000-row size is not exposed** |
| Column header | AXRow "Date Description …" then AXColumn index 0 to 4 | | | |
| Data row | AXRow | whole-row text | **selected=true, focused=true**, `index=4` | after scrolling to the end the rows are renumbered from 1 (`index` is relative to the rendered window, not the table) |
| Cell | AXCell with AXStaticText | "-$239.51" | rowRange / colRange given relative to rendered rows | |
| Details panel | AXGroup landmark "Transaction details" | | | |
| Legend row | AXButton | "Housing: $27,090, 31 percent. Show transactions" | | |
| Dialog | AXGroup subrole **AXApplicationDialog** | Reset settings? | | focused: Cancel button |

### Plain-words answer

Could a screen-reader user find a transaction, read its description, amount and category, and know which row is selected? **In the trees, yes on all three systems**: every row is a table row whose name contains date, description, account, category and amount, cells carry the individual values, and the selected row is flagged selected and focused. **Gaps:** (1) Only Windows reports the true table size (10,001) through its grid pattern; on Linux it is only an ARIA attribute (the AT-SPI Table interface says 30) and on macOS the size is the number of rendered rows (33) with row indices that restart as the grid scrolls, so a VoiceOver user is told the table has about 33 rows. (2) Cell-level indices exist on Windows and macOS (relative on macOS), not on Linux. (3) The keyboard model is a custom one (the scroll container, not the grid, takes focus and moves selection with the arrow keys); the screen reader may not understand it as a grid (see the NVDA run). (4) The charts are one image each; the legend rows and month table are the real access path. (5) A heading inside the details `dl` is invalid structure.

### Stretch: real screen readers (time-boxed; measured once each)

- **NVDA on Windows (Guidepup 0.40.0, MIT, current)**: it ran in CI (run C; `scripts/sr/run.mjs`, output `evidence/f3-screen-reader/screen-reader.txt`). With the grid focused and real ArrowDown key presses through NVDA, it announced "clickable, row 2, Description, column 2, Aeroflot Аэрофлот number 4389", then "Account, column 3, Travel Mastercard", then "Category, column 4, Flights and hotels": NVDA treated the grid as a table in browse mode and **moved cell by cell down the first data row**, reading row and column numbers, rather than moving row selection. **No "selected" announcement appeared in this run** and the app's own ArrowDown selection handler was not what NVDA reflected. Opening the dialog produced no announcement in the 1.5 s window I waited, and Tab then announced "Reset, button" (the focus was already past Cancel), so I cannot say what NVDA says when the dialog opens. One run, crude timing; treat as a pointer to the gap, not a conclusion.
- **VoiceOver on macOS**: could not run. After `npx @guidepup/setup setup --ci` reported "Environment setup complete", starting VoiceOver failed with "VoiceOver cannot be started" on `macos-26-arm64`.
- **Orca on Linux**: not attempted (out of the 30 minutes).

## E1. The non-loopback `connect()`

**What it is (confirmed from source).** I read Chromium **156.0.8078.96** (the version in Electron 45.3.0, checked with `strings` on the binary) from `chromium.googlesource.com` at tag `refs/tags/156.0.8078.96`:
- `net/dns/host_resolver_manager.cc`: `kIPv6ProbeAddress` = 2001:4860:4860::8888, with the comment "Google DNS address used for IPv6 probes" (lines 157–160); `GetPortForGloballyReachableCheck()` returns **443** unless `kUseAlternativePortForGloballyReachableCheck` is on (lines 288–294); `HostResolverManager::StartIPv6ReachabilityCheck` (line 1569) calls `StartGloballyReachableCheck` (line 1644), which creates a `DatagramClientSocket` and calls `ConnectAsync` to that address; `FinishGloballyReachableCheck` (line 1669) reads the local address and rejects link-local and Teredo ones. The result is cached for `kIPv6ProbePeriodMs = 1000`.
- Callers: `net/dns/host_resolver_manager_request_impl.cc` lines 299 and 308 and `host_resolver_manager_service_endpoint_request_impl.cc` lines 321 and 332. So **the probe runs for every host resolution request** (including a request to an IP literal), not at process start.
- Permalink base: `https://chromium.googlesource.com/chromium/src/+/refs/tags/156.0.8078.96/net/dns/`. I did not read the Electron-specific network setup.
- It is a UDP socket, so `connect()` only selects a route: confirmed in the captures (the connect returned 0 with an IPv6 route present and no packet followed).

**Why it happened in my app.** Chromium's net-log (`--log-net-log`, evidence `evidence/e1/netlog-release-baseline.json`, `variants-netlog.txt`) shows one request: `GET http://127.0.0.1:9/disabled/en-us-10-2.bdic`, the spellcheck dictionary download pointed at the loopback URL I set. It resolved the host (a literal IP), which ran the probe.

**Variants (measured; CI run B, IPv6 sink route plus IPv4 sink, 40 s each, release-equivalent scratch app, `scripts/e1-matrix.sh`; locally without IPv6 `variants-netlog.txt` agrees):**

| Variant | App packets | Non-loopback `connect()` / send syscalls | UDP probe `connect()` |
| ------- | ----------- | ---------------------------------------- | --------------------- |
| v0 fixed: spellcheck disabled and `setSpellCheckerLanguages([])` | 0 | 0 | 0 |
| v1 `setSpellCheckerEnabled(false)` only (the brief's hardening) | run A: **42 outbound DNS queries** (84 captured lines, the two ends of the veth) for `redirector.gvt1.com`; run B: the runner's resolver was the loopback stub 127.0.0.53, so the same lookups appear as 28 loopback packets with **0 off-box packets** | run A **27**; run B 0 (the queries went to the loopback stub) | 1 to 2 |
| v2 dictionary URL pointed at `127.0.0.1:9` (what I shipped) | 0 | 0 | 1 |
| v3 as v2 with IPv6 disabled in the namespace (`disable_ipv6=1`) | 0 | 0 | **1 (still attempted)** |
| v4 as v2 plus `--enable-features=EnableIPv6ReachabilityOverride` | 0 | 0 | **1 (still attempted)** |
| v5 as v2 plus `--host-resolver-rules="MAP * ~NOTFOUND"` | 0 | 0 | **1 (still attempted)** |
| v6 the real release binary (fuses on), no extra flags | 0 | 0 | 0 |

The analyzer originally treated all loopback traffic as safe, which would have hidden v1 in run B; it now also reports DNS queries for external names (`scripts/analyze-capture.mjs`), which flags v1 in both runs and nothing in v0, v2 or v6. On a connected machine (dev sandbox net-log, `variants-netlog.txt`) the v1 request actually reached `https://redirector.gvt1.com/edgedl/chrome/dict/en-us-10-2.bdic` and was redirected to a second `gvt1.com` host.

Also tried locally with the net-log (`variants-netlog.txt`): `--disable-features=AsyncDns` and `--disable-features=NetworkTimeServiceQuerying` do not stop the probe; **`setSpellCheckerLanguages([])` is the only change that stopped it**, because it stops the only request.

**Plain answer.** A result with **no `connect()` to any non-loopback address is achievable** for this app, and it is shipped: the release binary (v6) and the fixed scratch app (v0) show zero application packets and zero such syscalls with an IPv6 route available (CI run B, plus a local release-binary capture in a loopback-only namespace, `evidence/e1/fixed-release/`). It holds only because the app makes no request at all. The probe is not switchable by any flag I found: Chromium runs it before every resolution, even for IP literals. If a future feature makes a request (including a `folio://` fetch that triggers resolution, which I did not test), expect the probe to appear again. Disabling IPv6 in the operating system does not avoid the `connect()` attempt (v3).

**Agent findings and how I checked them.** Two subagents were used, for this item only, as approved. (a) A source-reading agent reported file, line and tag details; I **fetched the same files myself** and confirmed the constants, port, the call path, both callers, and `kEnableIPv6ReachabilityOverride` (`net/base/features.cc` lines 182–183, used at `host_resolver_manager.cc` lines 448 and 836). I confirmed by test (v4) that the override does not stop the probe, as the agent said. I did **not** verify its other claims: that `check_ipv6_on_wifi` defaults to true, that Electron leaves DoH off by default, anything about `NetworkTimeTracker`, and QUIC/CRL/captive-portal behaviour. (b) A prior-reports agent returned search snippets and one patch description. I did **not** verify its claims about the ungoogled-chromium `set-ipv6-probe-false` patch, the Popura issue, or the 2013 code review; they are not used above. Its guess that disabling IPv6 in the OS avoids the call is **refuted** by v3. The finding that the leak is the spellcheck dictionary request is mine, from the net-log, not from either agent.

**Fix in the app:** `src/main/hardening.ts` now calls `setSpellCheckerLanguages([])` and no longer sets a dictionary URL.

## E2. Chromium sandbox on Linux

**Measured**, `ubuntu-24.04` CI (kernel 7.0.0-azure; `kernel.apparmor_restrict_unprivileged_userns = 1`, `unprivileged_userns_clone = 1`) as the ordinary user `runner`, run B (`evidence/e2/e2-sandbox.txt`). "Sandboxed" below means the renderer process shows `Seccomp: 2` and no `--no-sandbox` on its command line.

| Case | Result |
| ---- | ------ |
| A. Packaged app as an ordinary user, no flags, `chrome-sandbox` not setuid | **Does not start.** `FATAL: The SUID sandbox helper binary was found, but is not configured correctly.` |
| B. Same, `chrome-sandbox` owned by root with mode 4755 | Starts, **sandboxed** |
| C. No setuid, `kernel.apparmor_restrict_unprivileged_userns=0` | Starts, sandboxed (user namespace) |
| D. No setuid, restriction on, an AppArmor profile that grants `userns` to the app binary | Starts, sandboxed |
| E. electron-builder **.deb** installed with `apt-get install` | Starts, **sandboxed**, no flags. Its postinstall installs `/etc/apparmor.d/folio-spike` (grants `userns`) and leaves `chrome-sandbox` at 0755 |
| F. electron-builder **AppImage** (`--appimage-extract-and-run`) | Starts, but **the renderer runs with `--no-sandbox` (`Seccomp: 0`) and prints nothing about it** |

**Why.** On Ubuntu 24.04 AppArmor blocks unprivileged user namespaces for apps without a profile. Chromium then falls back to the setuid helper, which is not set up for an unpacked or extracted app, so it aborts. For the AppImage I read the generated `AppRun`: it runs `unshare -Ur true` and, if that fails, **silently adds `--no-sandbox`**. Running as root (this dev container) also needs `--no-sandbox` ("Running as root without --no-sandbox is not supported").

**What a package needs.** A .deb works as built, but only because its postinstall (run as root by the package manager) writes the AppArmor profile; it also pulled `libappindicator3`, `libsecret` and `libnotify4` as dependencies (installing with `dpkg -i` alone failed on missing dependencies; `apt-get install` is the real path). An AppImage cannot install a profile or set a setuid bit, so on Ubuntu 24.04 and later it either runs unsandboxed (default) or needs the user to relax the system setting or add a profile (cases C, D). **The cost:** a per-distro install story, a root step for sandboxed installs, and a silent loss of the sandbox for portable formats. Package sizes: .deb 101 MB, AppImage 126 MB (Linux), NSIS installer 121 MB (Windows).

For testing I keep `--no-sandbox` on Linux CI runs (the runner has the restriction on and no profile for the unpacked app); the sandbox-on result above is separate evidence, not a change to the G3 scenario.

## E3. The tested-binary gap

**Measured, closed.** Chromium's own `--remote-debugging-pipe` works with the **exact release binary**, fuses on, inspect-arguments fuse off, with **no change to app code**. Playwright cannot attach to a pipe, so `tests/pipe-driver.ts` starts the app with the pipe on file descriptors 3 and 4, relays it to a loopback WebSocket **owned by the test process, not the app**, and attaches with `chromium.connectOverCDP`. The whole slice suite (`FOLIO_DRIVER=pipe FOLIO_EXE=<release binary> npx playwright test slice.spec.ts guard.spec.ts`) then runs against the release binary:
- **Linux, Windows and macOS: 16 passed, 1 skipped** on each (15 of the 16 slice tests plus the guard test), including a clean exit with code 0 (the app quits when its last window closes; the driver closes the window with `window.close()`). The skipped test needs main-process access (`__folioBlocked`); the capture jobs cover network behaviour instead. The window-visibility assertion uses the page's visibility state in this mode.
- Screenshots come from Playwright's CDP `Page.captureScreenshot` rather than `webContents.capturePage`; I did not need the latter.
- **Cost in code:** about 60 lines of test-only driver and a dev dependency on `ws` (MIT); no production code is needed for the drive itself.

**Does it weaken the hardening?** The pipe flag is a Chromium switch present in every Chromium-based binary; no fuse disables it. Anyone who can launch the binary with arguments can already run it as themselves. I limited the exposure two ways: the existing renderer automation hook (`window.__folio`) exists only when `FOLIO_AUTOMATION=1`, and I added a **guard in the main process**: if the app is started with `--remote-debugging-pipe`, `--remote-debugging-port`, `--remote-allow-origins` or `--inspect*` and `FOLIO_AUTOMATION` is not `1`, it prints a message and exits with code 2 (`src/main/main.ts`; `tests/guard.spec.ts` checks it on all three OSes). The guard runs after Chromium has started parsing flags, so a very early attach is not covered; I did not test that window. The release binary therefore refuses debugging in normal use. The shipped binary, with the same environment variable set, can be driven, which is the point of H1.17.

## E4. Memory levers (separate from the baseline)

**Measured locally** (Linux dev sandbox, Xvfb, **software GL**, root, `--no-sandbox`), same PSS tree method, points P1, P3, P4 only, one run per variant unless noted; the build is the packaged test binary. **These are not the CI numbers** and the sandbox gives about 30 MB lower values than the CI runner at P3 (E4 baseline 398 to 404 MB here versus 429 to 434 MB on CI). Variance: three baseline runs gave P3 of 397.6, 403.8, 404.0 and two `--disable-gpu` runs gave 361.7 and 340.5, so differences under about 20 MB are not significant.

| Variant (flags) | P1 PSS | P3 PSS | P4 PSS | Processes | Trade-off |
| --------------- | ------ | ------ | ------ | --------- | --------- |
| baseline | 330.5 | 397.6 | 359.2 | 6 | |
| baseline, repeat 2 and 3 | 333.9 / 337.7 | 403.8 / 404.0 | 329.6 / 333.5 | 6 | run-to-run spread of the baseline |
| `--disable-gpu` | 293.6 | 361.7 | 290.3 | 6 | -36 to -64 MB at P3. **Changes rendering:** all compositing and rasterisation in software; on a machine with a real GPU this would likely trade memory for CPU and scrolling smoothness. Not measured with a GPU. |
| `--in-process-gpu` | 361.9 | 425.9 | 356.9 | 5 | within noise (+28); fewer processes but the GPU runs in the browser process, a security downgrade |
| `--enable-features=NetworkServiceInProcess2` | 352.1 | 416.8 | 346.8 | 5 | within noise (+19); network service in the browser process: **less isolation** (the app makes no network requests, but any future one would run in the privileged process) |
| `--js-flags=--max-old-space-size=96` | 365.6 | 419.2 | 358.4 | 6 | within noise (+22); caps the V8 heap at 96 MB: no saving here, and **a crash risk** if the real app holds much more data |
| `--disable-gpu --enable-features=NetworkServiceInProcess2` | 246.7 | 324.1 | 254.1 | 5 | about -74 MB at P3; both trade-offs above |
| the same plus the V8 cap | 258.5 | 316.3 | 253.5 | 5 | about -81 MB; adds the V8 crash risk |
| `--no-zygote` | not measured | | | | dropped: as root with `--no-sandbox` the app aborts, and Chromium documents `--no-zygote` as incompatible with its sandbox, so it is not a lever that keeps the security posture |

**Practical floor (measured, same method):** an Electron window that shows an empty page (no React, no data) measures **266 MB PSS (RSS 544 MB, 8 processes)** by default, **196 MB** with `--disable-gpu`, **184 MB** with `--disable-gpu` and the network service in the browser process. So of this app's roughly 400 MB (local) at P3, about 270 MB is the framework before the app draws anything, and the floor for any Electron app on this setup is about 180 to 270 MB. A reasonable production configuration that keeps rendering, process isolation and the sandbox (none of the above levers) leaves the numbers as in F1. I found nothing that brings the P2 peak on the CI runner reliably under 400 MB PSS without turning off GPU rasterisation, and I did not test that on a machine with a real GPU.

## E5. Loose ends

- **npm audit.** The five moderate findings at the time of `RESULTS.md` were `@electron/packager` (direct dev dependency) and its chain `@electron/asar` 4.x, `@electron/universal`, `glob` and `minimatch` (ReDoS and an abort-signal traversal advisory; `evidence/npm-audit.json`). **All are build tools; none is in `app.asar`**, which holds only our compiled code and one Vite bundle. Adding `electron-builder` for the installer tests raised the count to 9 (it pulls `app-builder-lib`, `dmg-builder`, `electron-builder-squirrel-windows`, same advisories), also dev-only. All fixes require a breaking tool change; I did not apply them.
- **ASAR integrity fuse on Windows (measured, runs A and B, `evidence/e5/`).** It **works**: with the fuse on, an untouched `app.asar` starts; changing one letter inside a packed file makes the app refuse to launch, with both `@electron/packager` plus `@electron/fuses` and with electron-builder's `electronFuses`. Appending a byte after the end of the archive is **not** detected (neither header nor file content changes). Cost: the fuse is a one-way check at load; any post-build change (including code signing steps that rewrite the asar) must re-embed the digest. macOS and Linux were not tested.
- **Donut centre label:** my mistake, not a library limitation (Correction 3).
- **Windows sandbox (measured, `evidence/e5/sandbox-state-win.txt`).** In the Windows build, `app.getAppMetrics()` reports the **renderer sandboxed (integrity "untrusted")** and the **GPU process sandboxed ("low")**, the **browser process unsandboxed ("high", as expected)** and the **Network Service utility process `sandboxed: false` ("high")**. `webPreferences` in effect: sandbox on, context isolation on, node integration off. This was the test binary; the sandbox does not depend on the inspect fuse. So Chromium's sandbox is on for renderer and GPU but not for the network service, which is Chromium's default on Windows here, not something I configured.

## E6. Dependency facts

Read 2026-11-12. Commit and contributor counts are from shallow clones (`--shallow-since` 12 months before 2025-11-12) of each repository's default branch: `git shortlog -sn` and distinct author emails, which count identities, not people (bots and release accounts are included; I note them). Issue counts are GitHub search for open issues of type issue (pull requests excluded). npm "maintainers" are npm publish accounts.

| | Last release (npm) | Commits, 12 months | Distinct authors | Top author's share | Open issues / open PRs | Who maintains and funds |
| - | ------------------ | ------------------ | ---------------- | ------------------ | ---------------------- | ----------------------- |
| **Electron** [electron/electron](https://github.com/electron/electron) | 45.3.0 on 2026-11-10 | 1,757 | 142 (140 names) | 16% (Samuel Attard); the 3rd entry is a bot (`claude[bot]`, 171 commits) | 618 / 161 | **OpenJS Foundation** project (README cites the OpenJS Foundation trademark policy); npm publish accounts `electronhq` and `electron-nightly` |
| **Fluent UI React v9** [microsoft/fluentui](https://github.com/microsoft/fluentui) (`@fluentui/react-components`) | 9.75.2 on 2026-11-10 | 908 | 65 | 23% (Dmytro Kirpa); "Fluent UI Build" (88) and "Copilot" (34) are automation | 467 / 370 | **Microsoft** (README and npm publishers are Microsoft accounts: `uifabricteam`, `microsoft-oss-releases`) |
| **TanStack Virtual** [TanStack/virtual](https://github.com/TanStack/virtual) (`@tanstack/react-virtual`) | 3.14.26 on 2026-11-03 | 164 | 52 (51 names) | 29% (Damian Pieczynski); `github-actions[bot]` is 46 | 51 / 46 | **Single founder-led**: copyright "Tanner Linsley" (MIT licence), `FUNDING.yml` lists `github: tannerlinsley`, README has a sponsor and partner section; npm publishers: 3 accounts (`tannerlinsley`, `alemtuzlak`, `kevinvandy`). **Effectively one maintainer with a small set of other contributors and sponsor funding**; 52 identities in 12 months but a few do most of the work |
| **ECharts** [apache/echarts](https://github.com/apache/echarts) | 6.1.0 on 2026-05-19 (previous 6.0.0 on 2025-07-30) | 237 | 23 (28 names) | 42% (`100pah`); `dependabot[bot]` is 20 | 1,245 / 231 | **Apache Software Foundation** project (README points at the Apache Code of Conduct); 8 npm publish accounts. Slowest of the four: last commit 2026-10-04, **one release in the last six months** |

Single-maintainer risk, plainly: none of the four is a one-person project in the strict sense, but **TanStack Virtual is the closest** (a founder-owned MIT project with one dominant author and sponsor funding). ECharts has a small core (one author with 42% of the commits, 23 identities in 12 months). Electron and Fluent UI have large teams behind a foundation or a company. All four shipped within the last 6 months. Funding was read from repository files and READMEs; it is not an audit of anyone's finances. ECharts' licence is Apache-2.0, the others MIT.

## Effort

- Active time for this follow-up: about 2.3 hours of wall clock (about 01:08 to 03:25 UTC on 2026-11-12), most of it unattended waiting for CI (8 follow-up workflow runs).
- Prompts or corrections needed from the user: **0** beyond the follow-up prompt itself. (The earlier correction about the prototype is in `EFFORT-LOG.md` entry 31 of the first round.)
- Where time went: getting the new workflow to parse and run (YAML errors, `timeout` missing on macOS, a script that killed itself, PowerShell UIA finding no window); the E1 investigation (net-log); the sandbox and packaging matrix.

## Not measured

- Memory on a machine with a real GPU (all Linux numbers are software GL).
- A Windows or macOS packet capture attributed to the app (macOS: lsof only, low confidence; Windows: not attempted).
- VoiceOver and Orca runs; NVDA run was one crude scenario.
- Whether the spellcheck dictionary leak occurs on Windows and macOS (inferred no).
- Whether a very early attach defeats the remote-debugging guard.
- ASAR integrity on Linux and macOS; signed installers; auto-update (deliberately absent).
- Soak longer than 20 scrolls; `--no-zygote` under a working sandbox.
