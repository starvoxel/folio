# Results: Avalonia slice

- Stack and exact versions: .NET SDK 10.0.404 locally (global.json pins 10.0.100, roll forward latestFeature; CI uses setup-dotnet 10.0.x), Avalonia 12.1.5 (Avalonia, Desktop, Skia, Headless), Avalonia.Controls.DataGrid 12.1.2, SkiaSharp 3.119.4 (test CLI only)
- Design system and version: FluentAvaloniaUI 3.1.0
- Date range of the work: 2026-11-11 23:49 UTC to 2026-11-12 00:19 UTC (one session, about 30 min wall clock by the session clock, including waits)
- Commit measured: see the CI run linked below (run 3, commit `9b90a89`); the local numbers come from the same code before the CI-only workflow edits. Evidence: https://github.com/starvoxel/folio/actions/runs/43125343508

Code is in `avalonia/` (`Slice/` app, `Cli/` test client and G3 scenario, scripts `bench.sh`, `g1-privacy.sh`, `shots.sh`, `run-slice.sh`). Strict analyzers and warnings-as-errors were relaxed for the spike (three obsolete-API warnings remain: `TextBox.Watermark`, `Bitmap.Save`). Evidence files are in `avalonia/evidence/`; the rest is in the CI artifacts (`linux-evidence`, `windows-evidence`, `g1-evidence`).

## Gates

| Gate | Pass / Fail / Not measured | Evidence | Notes |
| ---- | -------------------------- | -------- | ----- |
| G1 Privacy | **Pass on Linux**, Windows and macOS not captured | `avalonia/evidence/g1-local/` (analysis.txt, strace logs, selftest results); CI job "Linux network capture (G1)", artifact `g1-evidence` | The whole scenario (44 checks, every page) passes in a network namespace that has only loopback. `strace -f -e trace=network` on the app process tree over launch, use and a 5-minute idle shows only AF_UNIX (X11, nscd), AF_NETLINK (local interface listing) and AF_INET to 127.0.0.1 (the automation server). No connect or send to any other address. The tcpdump on the host shows traffic, but it is this sandbox's own agent traffic (to 160.79.104.10 and 34.149.66.165 and a resolver), not the app: the app's syscalls show none. So the app-level evidence is the strace log, not the pcap. No telemetry, update or licence check exists in the shipped app. **Build-time telemetry exists**, see Problems. |
| G2 Grid at scale | **Pass** (stock DataGrid, no alternative needed) | CI Linux and Windows bench logs; `avalonia/bench.sh` | Worst frame 45.6 ms Linux CI, 76.1 ms Windows CI (none over 100 ms); memory under 275 MB, flat on the second pass; every sort under 85 ms to a rendered frame. Issue 228 (memory growth) was not seen with this data, but see the limits below. |
| G3 Testable and agent-drivable | **Pass** on Linux (Xvfb) and Windows | CI run 3: Linux selftest 44/44 twice, Windows selftest 43/43 with real OS keys | Real window, real OS key events. Screenshot compare, see below. |
| G4 Charts | **Pass** | Selftest checks and `avalonia/evidence/fidelity/` | Custom-drawn donut and bar chart (no library). Light and dark. Click-through verified against counts recomputed from the fixtures; legend rows reached by Tab and activated with Space. |
| G5 Footprint | **Pass** (no hard ceiling hit) | Numbers below | No installer was built. Self-contained publish folder is 107 MB (Linux) and 210 MB (Windows); zipped Linux 44.7 MB (local) / 46.9 MB (CI). Cold start under 2.5 s on every machine tried. Idle memory 150 to 235 MB. |
| G6 Licences and cost | **Pass** | `dotnet list package --include-transitive`, nuspec licence fields | All 29 packages are MIT except Avalonia.Angle.Windows.Natives (licence file, ANGLE's BSD-style licence). No paid component, no licence key. Avalonia.BuildServices is MIT but sends build telemetry (below). |

### G3 details

- Linux: `xvfb-run` then `folio-slice-cli selftest` (launches the real window, 44 checks). Run twice back to back in the CI job; the screenshots of all 8 pages matched within the 0.1 % pixel tolerance (locally 0 to 48 pixels differ out of 1.2 million, so the actual difference is under 0.004 %). The "compare with previous successful run" step had no earlier green run to compare against, so cross-run comparison is only within one job. I did not verify two separate workflow runs against each other.
- Windows: same scenario with real OS key events via `keybd_event`; 43 checks (the Unix file mode check is skipped) all pass. The app was in the foreground on the runner. A second Windows run with synthetic keys fails 3 checks, as expected (see Problems).
- Headless (extra): 44/44 pass on Linux with `HeadlessWindowExtensions.KeyPress` for keys.
- **Dialog focus (FluentAvalonia issue 766):** not reproduced. On Linux and Windows the focused element on open is a Button inside the FAContentDialog; Tab cycles TextBox, Button inside it and Escape closes it, with real OS keys. Caveat: I check "focus is inside the dialog", I did not check which button should be first.
- DataGrid UI-automation gap (issue 267): not measured, see Accessibility.

## Numbers

| Measure | Linux | Windows | macOS | How measured |
| ------- | ----- | ------- | ----- | ------------ |
| Installer or package size | No installer built. Publish folder 107 MB, zip 46.9 MB (CI) | Publish folder 210 MB, zip not measured | Not measured (no runner used) | `dotnet publish -r <rid> --self-contained`, `du -sm` |
| Cold start to usable window | 0.9 s (CI wall), 1.4 s local; in-app 0.83 s CI | 2.3 s (CI wall), in-app 2.06 s | Not measured | Wall time from process launch until `/status` says ready (window open, data loaded, two frames drawn) |
| Idle memory | 233 MB RSS (CI), 212 MB local | 149 MB RSS (CI) | Not measured | RSS from `/proc/self/status` or process working set, 3 s after ready on Overview |
| Memory after a full grid scroll, first pass | 270 MB (CI), 259 MB local | 189 MB | Not measured | Same, after pass 1 |
| Memory after a second scroll | 273 MB (CI), 257 MB local | 191 MB | Not measured | Same, after pass 2. No growth. |
| Worst frame time while scrolling | 45.6 ms pass 1, 31.4 ms pass 2 (CI); 64.6 / 34.7 local | 76.1 ms pass 1, 47.6 ms pass 2 | Not measured | Gap between animation frame callbacks while scrolling 10,000 rows 8 rows per frame (1,250 frames each pass); software rendering under Xvfb |
| Sort time (ms, compute+assign / to a rendered frame, worst of asc and desc) | Date 14/54, Description 20/62, Account 18/67, Category 18/68, Amount 8/82 (CI) | Date 23/46, Description 24/58, Account 20/42, Category 19/40, Amount 21/46 | Not measured | `/bench/sort`: our own sort of 10,000 rows plus 3 frames |
| Build time (clean) | CI step 19 s (Slice + Cli, incl. restore); 5 s locally with warm NuGet cache | CI step 31 s | Not measured | Stopwatch around `dotnet build` |

Limits of the G2 measurement: scrolling is programmatic (`ScrollIntoView`, 8 rows per frame), not mouse wheel or scrollbar drag. Frame time is the gap between frame callbacks on software rendering (Xvfb) and on a shared Windows runner, so GPU machines may differ. Frame callbacks fire at about 60 Hz, which adds up to one frame to the "rendered" sort time. Memory growth was checked over two passes, not a long soak. The fixture does contain Cyrillic, CJK and Arabic text (mixed text), which is the case issue 228 describes, and no growth appeared.

## Effort

- Active working time: about 30 min of wall clock by the session clock (23:49 to 00:19 UTC), including the 5-minute capture and CI waits. See `EFFORT-LOG.md`.
- Number of prompts or corrections the user had to give: 1 (the kickoff prompt). No corrections.
- Where most time went: getting Avalonia 12 / FluentAvalonia 3 APIs right from the compiler (about 6 fix rounds, no docs read), the test scenario and its keyboard handling, and the G1 and CI plumbing.

## Fidelity against the prototype

Side by side (prototype left, slice right), 1440x960: `avalonia/evidence/fidelity/{transactions,reporting,overview}-{light,dark}.png`; the individual shots are also in CI artifacts. Settings and the dialog have no prototype counterpart that I captured.

What differs and why:
- Shell: the nav pane, footer Settings item, spacing and light/dark colours come straight from FluentAvalonia and match closely. Missing: nav icons, "Saved at / sample data" pill (I show a plain "Unsaved changes: none" text), Save button, menu details. The pane title is "Folio" as the design notes ask; the prototype still says Month-End Review.
- FANavigationView keeps a selection indicator on Overview after navigating elsewhere (both bars show), a library issue of the kind in FluentAvalonia #602/#579. Not worked around.
- Transactions: grid works and looks Fluent, but the prototype's two-line date cell (weekday), "Parent > Child" category text, green positive amounts and the status filter are not built (spec did not ask for them). Account and Category columns truncate at this width.
- Reporting: the prototype has tabs, a second "money in" donut and a how-money-was-used bar; the slice has the spec's donut, bar chart and legends only. Chart colours are my own palette (not the prototype's). Charts are custom drawn and use theme brushes for text and grid lines, so they follow light and dark.
- Font: the platform default was used (Avalonia bundles Inter via Avalonia.Fonts.Inter, which the screenshots show), not tuned to the prototype's type scale; sizes were set ad hoc.
- DataGrid header colours had to be forced with a style (see Problems).

## Dependencies

6 direct (Avalonia, Avalonia.Desktop, Avalonia.Skia, Avalonia.Headless, Avalonia.Controls.DataGrid, FluentAvaloniaUI) and 23 transitive packages for the app, from `dotnet list package --include-transitive` (this lists the native-asset packages for every OS, so the shipped set per OS is smaller). The test CLI adds SkiaSharp. Concerns:
- Avalonia.Controls.DataGrid: deprecated upstream, bug fixes only.
- FluentAvaloniaUI: single maintainer (per risk R1 in the product docs; I did not re-check the repo's commit history).
- Avalonia.BuildServices: build-time telemetry, see below.
- Avalonia.Angle.Windows.Natives: native ANGLE build, own licence file.

## Accessibility

Not measured with a platform accessibility tool. I did not run an AT-SPI or UI Automation client, so I cannot say what the accessibility tree shows for the grid or legend rows. What I did verify:
- Every control in the slice was given an AutomationProperties.Name where it was created (nav items, search, filters, month box, chart legend rows, details panel, buttons), and the focused element's name is exposed in `/ui/state`.
- Keyboard: with real OS keys, Tab reaches nav items, the month ComboBox and the donut legend rows; Space activates a legend row; the dialog traps Tab and closes on Escape. I did not test every control in the slice by keyboard (for example the grid's arrow-key navigation, the bar legend rows, filters), and Tab went from the nav pane to the month box without visiting the Undo, Redo and Import buttons only because they are disabled.
- The DataGrid's row and cell automation gap (issue 267) is not tested here.

## Agent drivability (G3 mechanism)

AD-16 style loopback server inside the app, off unless `--automation`: `HttpListener` on `127.0.0.1` and a free port; random 32-byte token per session; port, token and pid written to a discovery file (0600 on Unix, per-user LocalAppData on Windows, or `--discovery <path>`); requests need header `X-Folio-Token`; an `Origin` header is rejected (403); `Host` must be `127.0.0.1:<port>` (HttpListener answers 404 or 403 first for others); bodies over 64 KB rejected; no static files, no CORS headers. Endpoints: `GET /status`, `GET /ui/state`, `POST /ui/navigate`, `GET /ui/screenshot` (PNG of the window), `POST /ui/invoke` (filter, sort, select, month, theme, clickDonut, clickBar, openDialog, closeDialog, key), `POST /bench/scroll`, `POST /bench/sort`, `POST /quit`. Not implemented: commands through the command layer (the slice has none) and `--headless --automation` beyond the platform switch.

Commands (from `avalonia/`):

```bash
dotnet build Slice -c Release && dotnet build Cli -c Release
./run-slice.sh out/x --theme dark --size 1440x960        # detached; writes out/x/discovery.json
export FOLIO_DISCOVERY=out/x/discovery.json
C=Cli/bin/Release/net10.0/folio-slice-cli
$C wait-ready; $C navigate Reporting; $C state; $C screenshot shot.png; $C quit
xvfb-run -a -s "-screen 0 1440x900x24" $C selftest Slice/bin/Release/net10.0/FolioSlice ../fixtures out/st --oskeys
```

Sample `state` after `navigate Reporting` (trimmed):

```json
{ "page": "Reporting", "month": "2026-01", "theme": "Light", "window": {"width":1440,"height":900},
  "dialog": {"open": false, "focusInsideDialog": false},
  "focused": "FANavigationViewItem \"Settings\"",
  "content": { "month": "2026-01",
    "donut": [ {"Key":"groceries","Label":"Groceries","cents":1824240}, "..." ],
    "bars": [ {"Month":"2026-01","inCents":2695869,"outCents":5674675}, "..." ],
    "legendRows": 33, "chartImplementation": "custom-drawn (Avalonia DrawingContext), no chart library" } }
```

The selftest compares what the app reports against numbers recomputed from the fixture files (search count, sort order, donut slice total, click-through row counts), so it tests behaviour and not just that pages exist.

## Privacy capture (G1)

Tool and method: (A) `unshare -n` with only `lo` up, Xvfb inside, whole selftest scenario, `strace -f -e trace=network` on the app; (B) normal namespace, same scenario plus 300 s idle (the app answered the status check afterwards), `strace -f -e trace=network` and `tcpdump -i any -w` in parallel. Run locally (files in `avalonia/evidence/g1-local/`) and again on a GitHub runner (artifact `g1-evidence`; I did not open that artifact's contents, only saw the job pass).

Result on Linux: A passed 44/44 with no route. B: 4,942 network syscalls logged; AF_INET only to 127.0.0.1; no other IP address contacted. 4 `/var/run/nscd/socket` connects (ENOENT, name-service cache lookups, no daemon) and a netlink route socket (interface listing). The pcap includes unrelated sandbox traffic, so attribution rests on strace. Windows and macOS: not captured.

## Problems and workarounds

1. **Build-time telemetry (G1/G6 finding).** The transitive `Avalonia.BuildServices` 11.3.2 runs an MSBuild task on every compile that sends usage data (hashed project name, machine GUID, hashed machine name, OS, CI detection, Avalonia version) to `av-build-tel-api-v1.avaloniaui.net`, unless `AVALONIA_TELEMETRY_OPTOUT=1` is set. Its README says build time only; the dll is not in the publish output (checked on Linux). My local builds before the CI workflow ran with it on; CI sets the opt-out. The real project should set the variable in Directory.Build.props/CI and add a check. Whether this conflicts with "no telemetry" is a call for the team since it is the build, not the app.
2. DataGrid column headers were invisible (white on white) with FluentAvaloniaTheme plus the DataGrid Fluent theme and no `FluentTheme` (Avalonia 12 moved it to a separate package that is not referenced). Workaround: a style setting header Foreground and Background from FA brushes.
3. No `Avalonia.Themes.Fluent` reference: `FluentAvaloniaTheme` alone supplies controls.
4. Synthetic key events do not reproduce real Tab handling: raising a routed KeyDown plus `FocusManager.TryMoveFocus` let Tab escape the dialog and the legend test fail. With real OS keys (xdotool, keybd_event) all pass, and in headless mode `HeadlessWindowExtensions.KeyPress` also passes. Conclusion: automated keyboard tests need real or headless-platform keys.
5. A launcher CLI that owned the app's stdout killed the app when it exited; fixed by starting the app from a script with output to a file.
6. The DataGrid `Sorting` event is handled by the slice (it sorts the list itself and sets header arrows by text), so DataGrid's own sort glyphs and comparers are not exercised.
7. FANavigationView leaves the Overview selection indicator on after navigating (above).
8. Moving between pages is done by setting `SelectedItem`; keeping pages cached made it simple.
9. The Linux CI "previous run" comparison could not run (no earlier green run).
10. Environment note: the sandbox had no .NET, so I installed the SDK with `dotnet-install` and `apt` tools (xdotool, strace, tcpdump); NuGet and the SDK download worked through the proxy.

## Opinion

Easy: once the APIs compiled, Avalonia plus FluentAvalonia gave a good Fluent shell, light and dark switching and a working ContentDialog almost for free. The stock DataGrid handled 10,000 mixed-text rows with flat memory, which was the biggest worry. Custom-drawn charts took about 25 minutes including hit testing and keyboard legends. A loopback automation server on `HttpListener` with token, Host and Origin checks was about 150 lines and gave a strong G3: real window, structured state, screenshots, identical on Linux and Windows. Screenshots on Linux were pixel-stable between runs.

Painful: finding Avalonia 12 / FluentAvalonia 3 API names and theme wiring by compiler error; invisible DataGrid headers; synthetic keyboard input being unreliable on a real window.

Worry for the real app: (1) the build-time telemetry package and the general question of what else third-party packages do, so keep the capture test in CI; (2) FluentAvalonia depends on one maintainer and the DataGrid is deprecated, and I did not test the DataGrid's accessibility (issue 267), which could matter for screen readers; (3) I did not measure screen-reader output, macOS, Windows network traffic, or long-run memory, and the performance numbers are from software rendering on shared CI machines; (4) the nav selection indicator bug and similar polish issues suggest more FluentAvalonia workarounds ahead.
