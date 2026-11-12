# Follow-up results: Avalonia slice

Marked per item as measured, not measured (with a reason) or inferred. Code is under `avalonia/`; raw evidence under `avalonia/evidence/` and in the CI artifacts of the runs linked below. Nothing in `RESULTS.md` was edited.

CI runs used (all on branch `spike/slice-avalonia`, GitHub-hosted runners):
- follow-up workflow, run 4 (commit `ac8ba07`): https://github.com/starvoxel/folio/actions/runs/43138014802 (Linux, Windows F1/F3/A1/A5, macOS)
- follow-up workflow, run 9 (commit `6a16fea`): https://github.com/starvoxel/folio/actions/runs/43141025834 (same jobs again, with the macOS accessibility script fixed and the Windows sampler validation added)
- slice workflow, runs 11 and 12 (identical app code): https://github.com/starvoxel/folio/actions/runs/43138014697 and https://github.com/starvoxel/folio/actions/runs/43138072424

## Corrections to RESULTS.md

1. **Accessibility statement.** `RESULTS.md` said every control was given an `AutomationProperties.Name`, and implied they reach the platform tree. On Linux (AT-SPI) the page content did **not** reach the tree at all in the original build: only the seven navigation items appeared (see F3 and A1). On Windows and macOS the content does appear. So "Accessibility: not measured" was right, but the implication that the names were visible to assistive technology was wrong for Linux.
2. **Build-time telemetry details.** `RESULTS.md` listed "hashed machine name". From the source and a decoded payload the exact fields are: a random machine GUID (stored in a file), SHA-256 of the project name (twice), SHA-256 of `MachineName-UserName-Platform` as a device id, IDE kind, CI provider, output type, target framework, RID, Avalonia version, full OS description string, CPU architecture, Accelerate tier and OS family. Also, `RESULTS.md` said the opt-out variable turns it off; that is only true without an Accelerate licence tier (A2).
3. **FluentAvalonia maintainer.** `RESULTS.md` repeated "single maintainer" from the project docs without checking. Measured (A6): one person made 159 of 193 commits in the last 12 months, but 11 different people committed. So: one dominant maintainer, not the only committer.
4. **Memory metric.** `RESULTS.md` memory numbers were single-process RSS on Linux and working set on Windows. They are not wrong, but they are not the F1 metric. The same-method numbers are below; Linux PSS is about 35 MB lower than RSS, and Windows private working set is far lower than the total working set.

## F1. Memory, same method

Measured. The app is one process on every OS (tree check found no children). Tool: `Cli memtest` (this repo), which drives the real window through the automation endpoints and measures the whole process tree.

Metric used per OS:
- Linux: sum of PSS and sum of RSS over the process tree from `/proc/<pid>/smaps_rollup`, via `tools/measure-memory.py`.
- Windows: `PROCESS_MEMORY_COUNTERS_EX2.PrivateWorkingSetSize` ("private WS") and `WorkingSetSize` ("total WS") from `GetProcessMemoryInfo`, summed over the tree (tree found with `Get-CimInstance Win32_Process`).
- macOS: `footprint -p <pid>` ("phys_footprint") and `ps -o rss`, summed over the tree.

Scenario (same as the spec): P0 Overview 5 s; P1 Transactions 5 s; P2, P3 after scrolls 1 and 2 (+3 s); P4 after scroll 3 plus 60 s idle; P5 after a soak of 20 more full scrolls with a sort (cycling columns and directions) and a filter change (search "sobeys", then cleared) before each, then 60 s idle. A scroll is the programmatic 10,000-row pass from `RESULTS.md`. Commands: `folio-slice-cli memtest <app> ../fixtures <outdir> --measure-script ../tools/measure-memory.py` (Linux under `xvfb-run`). Accessibility was off (default).

| Point | Linux PSS (MB) | Linux RSS (MB) | Windows private WS (MB) | Windows total WS (MB) | macOS footprint (MB) | macOS RSS (MB) |
| ----- | -------------- | -------------- | ----------------------- | --------------------- | -------------------- | -------------- |
| P0 Overview, 5 s | 187.8 | 224.6 | 62.0 | 150.0 | 151 | 225.7 |
| P1 Transactions, 5 s | 208.1 | 245.1 | 81.1 | 176.6 | 166 | 243.9 |
| P2 after scroll 1 | 223.7 | 260.8 | 86.9 | 187.6 | 177 | 259.2 |
| P3 after scroll 2 | 223.9 | 261.0 | 87.1 | 188.1 | 177 | 259.3 |
| P4 after scroll 3 + 60 s idle | 224.7 | 262.0 | 64.4 | 161.4 | 142 | 259.8 |
| P5 after soak | 256.8 | 289.0 | 75.1 | 115.0 | 165 | 282.3 |

Windows was run twice (run 4 and run 9): run 9 gave private WS 63.1, 81.7, 86.8, 87.3, 65.8, 75.3 MB and total WS 154.2, 179.1, 188.1, 188.9, 161.3, 113.2 MB for P0 to P5, within 4 MB of run 4 at every point.

Sources: Linux = run 4 CI artifact `followup-linux` (`avalonia/evidence/memory-ci/linux-memtest.json`); Windows = run 4 `followup-windows`; macOS = run 4 `followup-macos`. Soak checkpoints (after 5, 10, 15, 20 scrolls) are in the JSON files. Repeats: Linux run 1 CI P5 PSS 269.0 MB; a local Linux run (not a CI machine) gave P0 to P5 PSS 179.1, 202.0, 223.3, 229.7, 227.5, 266.9. So run-to-run spread at P5 is about 10 to 15 MB on Linux.

Against the 400 MB G2 limit, per metric, no redefinition: **every metric at every point is under 400 MB: pass** (highest value in any column is Linux RSS 289 MB). Which metric the limit applies to is left to Jeremy.

Growth over the soak (P3 to P5): Linux PSS +33 MB (224 to 257; run 1 +45 MB, local +37 MB). It rises in the first 5 to 10 soak scrolls and then moves within a band of about 250 to 263 MB (checkpoints after 5, 10, 15, 20 scrolls: 244, 253, 260, 251 MB), so it looks like it levels off, but I ran one soak of 20 scrolls and cannot rule out slow growth beyond that. Linux RSS +28 MB (261 to 289). Windows private WS goes down (87 to 75) and total WS goes down (188 to 115): Windows trims working sets of an idle window, so these two Windows numbers measure what the OS keeps resident, not what the app has allocated; the managed heap and commit are not in this table. macOS footprint: 177 at P3 and 165 at P5 (it drops to 142 at P4 after the 60 s idle, then 159 to 166 during the soak): no growth. macOS RSS +23 MB (259 to 282), levelling at 282.

With accessibility on (Avalonia): measured on Linux only, short version. With the AT-SPI bus running and a client walking the tree every 10 s, a shorter run (soak of 2 scrolls, 20 s idles; `avalonia/evidence/memory-local-linux/memtest-with-atspi-client.json`) gave PSS 188.4, 215.9, 237.5, 235.4, 238.0, 249.5 MB for P0 to P5. Against the 179 to 188 (P0), 202 to 208 (P1), 223 (P2) of the runs without it, that is about +0 to +14 MB (+0 to 6 %) in one run on a different day, so I would call it a small effect, not a measured one. Windows and macOS with a screen reader attached: not tested (no screen reader run, see F3).

## F2. macOS

Measured (hosted runner `macos-latest`, arm64, a `192.168.64.x` VM).

- **Builds and starts: yes.** `dotnet build` in about 10 to 17 s (setup excluded), the app creates a real window on the hosted runner (the runner has a logged-in GUI session; `AXIsProcessTrusted` returned true for the test process, so the Accessibility permission was available). Cold start to ready: 1.08 s wall (0.91 s in the app).
- **G3 scenario:** `selftest` on the real window with synthetic keys: 40 of 43 checks pass (the full run with 300 s idle: 41 of 44). The failing checks are the same three that fail with synthetic keys on Linux and Windows (Tab reach of the legend, Tab cycling inside the dialog, Escape closes the dialog). Real OS key events on macOS were **not tested**: I had no keystroke tool wired up (no `cliclick`; `osascript` System Events keystrokes were not tried). So the dialog focus on open is confirmed on macOS (focus lands on a button in the dialog), but Tab cycling and Escape are not.
- **Memory:** in the F1 table. **Screenshots:** every page, light and dark: `avalonia/evidence/macos/shots-light/` and `shots-dark/`. The window came out at 1024 by about 650 px (the runner display is small), so the layout is cramped (filters wrap to two lines, the Date to Account grid columns are cut) but works.
- **Network observation (best effort):** `tcpdump -i any` plus `lsof -i` sampled every second for the whole run, which includes launch, every page and 300 s idle. In 844 lsof samples the app (`FolioSlice`, one pid) showed only loopback sockets (`127.0.0.1` listener and the CLI's connections); no non-loopback socket. All non-loopback traffic belonged to the runner's own processes (`Runner.Worker`, `Runner.Listener`, `hosted-compute-agent`, `provjobd`, to GitHub and Azure addresses). Confidence: medium. `lsof` sampling every second can miss a connection that opens and closes inside a second, and DNS lookups made by the system resolver (`mDNSResponder`) would not appear as the app's sockets. The packet capture cannot attribute packets to a process. No test of the shipped app's network use beyond that.
- Native menu bar: not done (not required).

## F3. Platform accessibility

Measured. Raw dumps: `avalonia/evidence/a11y-platform/{linux,windows,macos}/`. Tools: `avalonia/tools/atspi_dump.py` (python `gi` and `Atspi`), `avalonia/tools/uia-dump.ps1` (`System.Windows.Automation`), `avalonia/tools/ax-dump.swift` (`AXUIElement`). Each is run by a script (`a11y-linux.sh`, `a11y-mac.sh`, CI steps) that launches the real app and dumps the tree for the Transactions page, with a row selected, Reporting, Settings and the open dialog. "Default" is the app as measured in `RESULTS.md`; "fix" is the same app with `--a11y-fix` (A1).

What I had to do: Linux needed a session bus with the AT-SPI bus launcher (`dbus-run-session` plus `at-spi-bus-launcher`) running before the app starts; Avalonia then registered itself on the bus as "Avalonia Application" without further switches. Windows and macOS needed nothing (the macOS runner granted the Accessibility permission).

### Linux (AT-SPI), default build

| Element | Role | Name | State, notes |
| --- | --- | --- | --- |
| Navigation item, Settings item | list item | the page name | focusable, selectable; the current page has `selected`. Exposed. |
| Top-bar menu button, search box, filter drop-downs, grid, details panel, legend rows, month combo | **not in the tree** | | The whole page content, top bar and Settings page are missing. The tree under the window contains only the `FANavigationView` with its 7 items. |
| Confirmation dialog | panel `FAContentDialog` (no dialog role, no name) | contains labels with the title and text, and buttons Reset and Cancel | `Cancel` has `focused`. The dialog is in the overlay layer, so it is visible even in the default build. |

### Linux (AT-SPI), with the fix (page content outside the navigation view; rows named)

| Element | Role | Name | State, notes |
| --- | --- | --- | --- |
| Top-bar buttons | push button | Undo, Redo, Import CSV, ☰ Menu | exposed, focusable (disabled ones report no `enabled`) |
| Search box | entry | Search | |
| Filter drop-downs, month | combo box | Account filter, Category filter, Month | value as a child label |
| Grid | tree table | Transactions table | interfaces: Accessible and Component only. **No Table interface: no row count, no column count, no cell coordinates.** |
| Column headers | column header | Date ▲, Description, Account, Category, Amount | sort arrow is in the name |
| Data row | table cell (a row, oddly typed) | default build: `DataGridRow` (no text); fix: "2026-01-01, Air Canada, Rewards Visa, Flights and hotels, -$480.98" | no `selected` state in either. With the fix, the word ", selected" is appended to the name of the selected row: a workaround, not a real state. |
| Cell | unknown, with a label child | the cell text (for example "Air Canada") | focusable |
| Rows realized | 22 children under the rows presenter | | The grid is virtualized; the tree shows the rows that exist, 22 at a time. The total (10,000) is not reported anywhere. When it scrolls, new row objects appear and the old ones go away. |
| Details panel | label | "2026-01-01 -$480.98 / Account: Rewards Visa / Category: Flights and hotels (Travel) / Note: Warranty" | exposed after the fix |
| Donut legend row, month buttons | push button | "Housing, $27,089.50", "2026-03 money in, $…" | 42 push buttons on the Reporting page (5 top-bar buttons, the donut legend and the month in and out buttons), focusable |
| Donut and bar chart drawing | panel (donut) / not exposed (bar) | donut name only | the drawn chart has no per-slice or per-bar element; the legend buttons are the accessible route |
| Dialog | panel (named after the fix, "Reset this month's review? dialog") | | title and body are labels; focus is on `Cancel` when it opens |

### Windows (UI Automation)

| Element | Control type | Name | Patterns, state |
| --- | --- | --- | --- |
| Navigation items | ListItem | page name | SelectionItem (`IsSelected` is correct), focusable |
| Grid | DataGrid | Transactions table | **only a ScrollItem pattern: no Grid, Table or Selection pattern, so no row or column counts** |
| Column header | HeaderItem | Date ▲ etc. | |
| Data row | DataItem | default: empty name; fix: the row text, with ", selected" when selected | no SelectionItem pattern, so selection is not exposed |
| Cell | Custom | the cell text | focusable |
| Dialog | (inside window; named after the fix) | | focus is on the `Cancel` button (`HasKeyboardFocus`) |

On Windows the page content is present in the default build (no navigation-view problem). Top-bar buttons, search box, filters and legend buttons appear as normal controls.

### macOS (AXUIElement), default and fix

| Element | Role | Name | Notes |
| --- | --- | --- | --- |
| Navigation items | AXRow (in a table-like scroll area) | page name | `AXSelected` is 1 for the current page |
| Top-bar buttons, search, filters | AXButton, AXTextField, AXPopUpButton | names as set | exposed in the default build |
| Grid | AXGrid | Transactions table | no row or column counts (`AXRowCount` reports 0 on every element, so it is not a usable count) |
| Column headers | AXButton inside an AXHeading | Date ▲ etc. | |
| Data row | AXCell (one per row) | default: empty title; fix: the row text | `selected=0` even for the selected row in both builds (the fix adds ", selected" to the name only) |
| Dialog buttons | AXButton | Reset, Cancel | `Cancel` is `AXFocused` |

### Plain words: could a screen-reader user find a transaction?

- **Default build, Linux:** no. The page content is not in the accessibility tree, so a screen reader sees a navigation list and nothing else.
- **Default build, Windows and macOS:** partly. They can reach the grid and its cells, and each cell has readable text, but a row has no name, so moving between rows announces cell by cell with no row context. Nothing says which row is selected, how many rows there are or where you are in the table.
- **With the fix (about 30 lines):** yes on all three for finding and reading a transaction: each row is named with description, amount, account and category, and the details panel is readable text. Still missing on all three: a real selected state (only the text ", selected"), the total number of rows and the row position (the position and set size attributes I set are not visible in these dumps), and any table semantics (no Table or Grid pattern/interface), which screen readers use for "row 4 of 10,000, column 2" and table-navigation shortcuts.
- **Dialog:** focus lands on a button inside it on all three OSes. On Linux the dialog has no dialog role and no name unless named in code (the fix does that).
- **Chart:** the drawn donut and bars cannot be read; the legend buttons are readable and actionable.
- **Stretch (real screen reader): not attempted.** The time went to the dumps and A1 to A6; NVDA, VoiceOver and Orca were not run, so what is announced is not known.

## Stack-specific items

### A1. DataGrid accessibility

Measured. Answers for the stock DataGrid (default build), then the fix.

| Question | Linux (AT-SPI) | Windows (UIA) |
| --- | --- | --- |
| Exposed as a table or grid? | tree table role, but only the Component interface (no Table) | DataGrid control type, only ScrollItem (no Grid, Table) |
| Rows and cells reachable? | yes, but **only if the page is in the tree at all**; in the default build the whole page was missing on Linux because of FANavigationView (below) | yes |
| Cells have readable text? | yes (a child label with the text) | yes (cell name is the text) |
| Selected row indicated? | no | no |
| Row and column counts? | no | no |
| Rows named? | no (name `DataGridRow`) | no (empty) |

Finding 1: **FluentAvalonia's `FANavigationView` hides its `Content` from AT-SPI.** Replacing it with a plain `ListBox` brought the entire page, grid included, into the tree. The cause is inside FluentAvalonia's automation peer; it lists the navigation items and not the content. I did not look at why. It does not happen on Windows or macOS.
Finding 2: Avalonia's AT-SPI layer has no Table handler, and `DataGridRowAutomationPeer` has no selection provider, so selected state and counts cannot be added by app code that only sets properties. Issue 267's description ("rows and cells are not exposed") is therefore partly out of date for 12.1.x: rows and cells are exposed as elements with text, but not as table semantics.

Fix (time-boxed, about 40 minutes including finding 1): `--a11y-fix` does three things, about 30 lines in total in `MainWindow.cs`, `TransactionsPage.cs` and `SettingsPage.cs`: (1) the page content is a sibling of the navigation view (overlaid on its empty content area) instead of its `Content`; (2) each realized row gets `AutomationProperties.Name` (description, date, account, category, amount, plus ", selected" when selected), `PositionInSet` and `SizeOfSet` in `LoadingRow`, and the names are refreshed on selection change; (3) the dialog gets a name. The screenshot of the fixed build looks the same as the original (checked). Result: works for finding and reading a row on all three OSes (tables above). Does not give true selection state, row counts or table semantics; that would need Avalonia or DataGrid changes (a Table interface in the AT-SPI layer, a selection provider on the row peer), or replacing the grid. I did not try a replacement grid. A `ListBox`-based list would give real "selected" and list semantics for free but not columns or header sorting; I did not build it. Cost of the fix in the app: it relies on the content layout hack, which changes how the page sits next to the pane and will need care when the pane collapses (the hack uses a fixed left margin equal to the pane length, so it will not follow a collapsed or compact pane).

### A2. Build-time telemetry, verified

Measured, plus source reading (`AvaloniaUI/Avalonia.BuildServices`, commit `a6a4257`, 2026-04-18; the NuGet package is 11.3.2).

- **How it works.** The package adds an MSBuild target `AvaloniaStats` that runs before `CoreCompile` whenever `UsedAvaloniaProducts` is set (it is set by the Avalonia package). The task writes one record into `~/.local/share/AvaloniaUI/BuildServices` (Windows: `%LOCALAPPDATA%\AvaloniaUI\BuildServices`) and starts a detached `dotnet exec ...Avalonia.BuildServices.Collector.dll` that posts all pending records (up to 50 per request) to `https://av-build-tel-api-v1.avaloniaui.net/api/usage`, then waits up to 30 s for more. The collector builds its own HTTP connection (direct DNS, IPv4 only), so it **does not use the proxy environment variables**. It logs failures to `collector.log` in the same folder.
- **Fields actually sent** (source and a decoded 289-byte record, `avalonia/evidence/telemetry/payload-sample.bin`): format version 2; a record GUID; timestamp; machine GUID (random, kept in an `id` file); SHA-256 of the first segment of the project name and of the full project name; three empty strings; IDE kind (the sample says CLI); CI provider (none in the sample); output type; target framework; runtime identifier; Avalonia version; the OS description string (for example "Ubuntu 24.04.5 LTS"); CPU architecture; a device id that is SHA-256 of `MachineName-UserName-Platform`; the Accelerate tier; OS family. Source code, file paths and project contents are not in it. The server also sees the sender's IP address, as with any request.
- **Observation, clean builds in a loopback-only network namespace** (`avalonia/tools/telemetry-check.sh`; runs locally and in CI, artifact `followup-linux`; strace on the build process tree):
  - Default (no opt-out): the collector process is started (1 `execve`), a record file and `collector.log` are written, and the collector tries DNS for the endpoint host: `connect()` to the resolver ENETUNREACH in the namespace locally (on the CI runner the stub resolver at 127.0.0.53 answered), and the host name `av-build-tel-api-v1` appears in the DNS traffic (1,132 matches in the CI strace). Nothing could leave the namespace, so I did not observe the HTTPS POST itself; it is read from the source. `RESULTS.md` said local builds before I set the opt-out may have sent data: the first build on the sandbox (before the opt-out) ran with a direct network route, so that one may have been delivered; the record file was gone afterwards, which is what the collector does after a successful send (it also deletes nothing on failure). I cannot prove either way.
  - `AVALONIA_TELEMETRY_OPTOUT=1`: no collector, no record file, no network activity.
  - Most robust off switches tested, each with the opt-out variable unset: (a) a direct `PackageReference Include="Avalonia.BuildServices" ExcludeAssets="all"` (with a central version): the task is never imported, no collector, no files; (b) a `Directory.Build.targets` that redefines `AvaloniaStats` as an empty target: no collector, no files. All four builds succeeded. I only built (did not run the app) for variants (a) and (b); the app itself is unaffected by a build-time task in principle, but I have not run those two binaries.
  - **Recommendation:** use (a) or (b) in the repo so it does not depend on every developer and CI having an environment variable, and also keep the variable in CI.
- **Accelerate tooling changes this.** In the task source, if the machine has an Accelerate licence of tier Community or Trial (found from the tool sign-in tickets, the online key cache or a licence key item), the opt-out is **ignored** ("Accelerate Community requires telemetry. To opt out, please upgrade to a paid tier", same for Trial). Only the unlicensed (FOSS) case respects the variable. This matters if anyone on the team signs in to the free Accelerate Community tools. Options (a) and (b) above are not affected by the tier, because the task never runs; whether Avalonia considers that acceptable I do not know. I did not sign in to Accelerate, so the override path is read from source, not observed. `NCrunch` being set also counts as an opt-out in the code.
- **Shipped output.** The published self-contained folder (Linux, `dotnet publish`) has no `Avalonia.BuildServices*` file (listing checked); the package puts the task only under `tools/` and `build/`. The running app never contacted the endpoint or any non-loopback address in the G1 captures (strace of the app process, loopback-only namespace and five-minute idle; plus the Windows and macOS observations above). The endpoint string is in the collector, which is not copied to the output.

### A3. Evidence I did not open

Measured. I downloaded `g1-evidence`, `linux-evidence` and `windows-evidence` from CI run 3 (`43125343508`) and read them.
- `g1-evidence`: matches `RESULTS.md`. strace logs show only AF_UNIX, AF_NETLINK and 127.0.0.1 AF_INET; selftests passed (44/44 in the namespace, 45/45 with the idle). The pcap shows only the runner's own traffic (GitHub, Azure wire server `168.63.129.16`, instance metadata `169.254.169.254`); the app is attributed by strace, as stated.
- `linux-evidence`: build 19 s, publish folder 107 MB, zip 46.9 MB, run 1 vs run 2 screenshots all within tolerance (0 pixels differ in all eight), `compare-previous.txt` says "no previous successful run yet". As stated.
- `windows-evidence`: build 31 s, publish folder 210 MB; run 1 selftest 43/43. One thing `RESULTS.md` did not say: the Windows "run 2" folder holds the synthetic-key run, whose screenshots differ from run 1 (for example `Settings-switched.png` differs in 99.998 % of pixels because the failed Escape left the app in a different state), so those two Windows folders are not a stability comparison. `RESULTS.md` did not claim one for Windows. Not a correction, a clarification.

### A4. Cross-run screenshot stability

Measured. Two separate workflow runs of the slice workflow on identical app code (runs 11 and 12: only evidence and docs files changed between them), the "run 1" real-window scenario screenshots, 8 pages each, tolerance 0.1 % of pixels (a pixel differs if any channel differs by more than 2).
- **Linux (Xvfb):** run 12 against run 11, from the workflow's own comparison step: 0 pixels differ on 6 pages, 48 pixels (0.0037 %) on 2 pages (Accounts, Rules and categories). All within tolerance. Within one job (two consecutive launches) it was 0 or 48 pixels as well.
- **Windows:** run 12 against run 11, compared locally from the two downloaded artifacts: 0 pixels on 6 pages, 48 pixels (0.0062 %) on 2 pages (Reporting, Transactions). All within tolerance (`avalonia/evidence/cross-run/windows-run11-vs-run12.txt`).
- The 48-pixel difference shows up in a different page each time; it looks like the same small glyph or caret pixel block, but I did not locate it. Linux and Windows images are not compared with each other (different fonts and sizes).

### A5. Windows network observation (best effort)

Measured, with limits. `avalonia/tools/win-netwatch.ps1` samples `Get-NetTCPConnection` and `Get-NetUDPEndpoint` every ~0.5 s (about 730 samples over the 7 minutes), keeps every row owned by a process named `FolioSlice`, tallies all other processes' non-loopback connections, and runs `pktmon` on all NICs. The scenario was the selftest (launch, every page, filters, dialog, theme) plus 300 s idle (`44 of 44` checks passed).
- **Result (run 4):** 0 rows with a non-loopback remote address for `FolioSlice`. The sampler also recorded 0 rows for `FolioSlice` at all, including loopback: that is expected because the automation server uses `HttpListener`, which on Windows listens through HTTP.sys, so its listening socket belongs to the System process, and the app opened no sockets of its own. This was not by itself proof the sampler could see the app, so run 9 added a validation file (`avalonia/evidence/windows-net/loopback-and-listeners-validation.txt`). Result: the sampler saw the test client's loopback connections (`folio-slice-cli`, Established 127.0.0.1 to 127.0.0.1, 124 samples) and the HTTP.sys listeners owned by `System` (127.0.0.1 and other local addresses), and again 0 rows for `FolioSlice`. So the sampler does see sockets by process; the app simply owned none. Run 9 repeated the result: 0 non-loopback rows for the app over 698 samples; pktmon destinations were again only runner and Azure addresses.
- **Runner background traffic** (all attributable to other processes): `Runner.Listener` and `Runner.Worker` to GitHub (`140.82.x.x`, `20.85.130.105`), `hosted-compute-agent` and `provjobd` to `20.75.202.224`, `WaAppAgent` and `WindowsAzureGuestAgent` to the Azure wire server `168.63.129.16`, `svchost` to `20.59.87.x`, `StartMenuExperienceHost` to Microsoft addresses, `Idle` (kernel) to the instance metadata address. pktmon destinations (all processes): the same set (a mix of GitHub, Azure and runner addresses), none unexplained.
- **Confidence: medium.** What it can show: no socket owned by the app process to a non-loopback address at any of ~730 samples. What it cannot show: a connection shorter than half a second; DNS lookups (they are made by the DNS Client service, not the app, so they would not show as an app socket, and pktmon cannot attribute packets to a process); and traffic by a different process on the app's behalf (none expected: the app is one process and has no children).

### A6. Maintenance facts

Measured, from the GitHub API and nuget.org in CI (`avalonia/evidence/maintenance/summary.txt`), on 2026-11-12.

| | FluentAvaloniaUI (`amwx/FluentAvalonia`) | Avalonia.Controls.DataGrid (`AvaloniaUI/Avalonia.Controls.DataGrid`) |
| --- | --- | --- |
| Last commit | 2026-08-22 ("Merge pull request #768 from amwx/FA3.1", by the maintainer) | 2026-08-03 ("Merge pull request #256 …", by the Avalonia core team member MrJul) |
| Last release | 3.1.0 on NuGet, 2026-08-22 (GitHub Releases are not used) | 12.1.2, 2026-08-03 (GitHub release and NuGet) |
| People who committed in the last 12 months | 11 (one person made 159 of 193 commits; next: 10, 8, 5, 3, 3, 1 ...) | 7 (MrJul 47 of 65; then 7, 5, 3, 1, 1, 1) |
| Open issues | 36 open issues and 6 open pull requests | 163 open issues and 5 open pull requests |
| Links | https://github.com/amwx/FluentAvalonia , https://www.nuget.org/packages/FluentAvaloniaUI | https://github.com/AvaloniaUI/Avalonia.Controls.DataGrid , https://www.nuget.org/packages/Avalonia.Controls.DataGrid |

Most recent maintainer statements found by listing the main committer's latest comments (links to the comments):
- FluentAvalonia, 2026-07-31, on bug issue #748: "changing back to `target.GetType()` is the correct solution … If you'd like to submit a PR … " https://github.com/amwx/FluentAvalonia/issues/748#issuecomment-5147806701 . Same day, #756: "The suggested fixes look good to me. If you'd like to submit a PR I'll accept these changes. If not, I'll get to it in the next couple of days." https://github.com/amwx/FluentAvalonia/issues/756#issuecomment-5147669475 . 2026-05-17, on whether Avalonia's own Fluent v2 theme affects FluentAvalonia: "FA will still host and ship with its own version and will not adopt Avalonia's" https://github.com/amwx/FluentAvalonia/issues/737#issuecomment-4468979728 . 2026-06-20 on a clipboard feature: "The plan was to support the minimum to get the control working for v3/Av12 …" https://github.com/amwx/FluentAvalonia/issues/742#issuecomment-4759002967 . A roadmap issue exists (https://github.com/amwx/FluentAvalonia/issues/655, closed 2026-06-20).
- DataGrid, 2026-08-03: "Thank you, but we aren't accepting new features for the DataGrid." (PRs #240 and #242) https://github.com/AvaloniaUI/Avalonia.Controls.DataGrid/pull/240#issuecomment-5165597959 ; the same on 2026-05-28 with a pointer to the policy discussion https://github.com/AvaloniaUI/Avalonia/discussions/18388 https://github.com/AvaloniaUI/Avalonia.Controls.DataGrid/pull/239#issuecomment-4564525340 ; 2026-06-23, fixes released in 12.0.1 https://github.com/AvaloniaUI/Avalonia.Controls.DataGrid/pull/235#issuecomment-4781727177 .
- The last FluentAvalonia commit is about 11 weeks old at the time of the check and the repository was still updated on 2026-11-10 (an open pull request #770 from 2026-08-23 shows the maintainer had not yet reviewed it). Not checked: whether FluentAvalonia has said anything about Avalonia 12.2 support (the risk register in the product docs says it had announced none); the one-line search for statements about maintenance returned only the Fluent v2 and roadmap threads above.

## Effort

About 1 h 40 min of wall clock for this follow-up by the session clock (01:14 to about 02:55 UTC), a large part of it waiting for CI (the memory scenario alone takes 10 to 13 minutes per OS) and for the 5-minute captures. Prompts or corrections needed from the user: 1 (the follow-up prompt); platform reminders to commit were followed. Details in `EFFORT-LOG.md`.

## Not measured

- A real screen reader (NVDA, VoiceOver, Orca): not attempted; no time left after the dumps and the A1 fix, and I did not check which tools are current and free.
- Memory with a screen reader attached on Windows and macOS: not tested; on Linux only the short run described under F1.
- Real OS key events on macOS (Tab cycling, Escape): not tested (no keystroke tool). Linux and Windows have them from `RESULTS.md`.
- The telemetry POST itself: not observed (the namespace has no route); the Accelerate override path: read from source, not run (I did not sign in).
- A replacement grid (ListBox-based or otherwise): not built.
- Windows traffic from DNS or very short connections; macOS packet attribution by process.
- Open issue counts and statements for FluentAvalonia issue 766 (dialog focus) and DataGrid issue 267 and 228 specifically: not read; I only observed behaviour.
- A soak longer than 20 scrolls.
