# Effort log: Avalonia slice

Times are UTC from the session clock. Prompts or corrections from the user: **1** (the kickoff prompt only; none since).

- 23:50 Session start. Read spec, README, template, product context. Machine had no .NET; installed SDK 10.0.404 with dotnet-install (global.json pins 10.0.100, rollForward latestFeature). No xdotool on the box.
- 23:50 Scaffolded avalonia/ (Directory.Build.props, central package pins: Avalonia 12.1.5, DataGrid 12.1.2, FluentAvaloniaUI 3.1.0). Relaxed for the spike: TreatWarningsAsErrors off, no strict analyzers.
- 23:57 First full build compiled after ~6 fix rounds (API renames in Avalonia 12/FA 3: no FluentTheme without Avalonia.Themes.Fluent so only FluentAvaloniaTheme is used; FANavigationView*, FAContentDialog; no public way to inject raw key events on a real window so SendKey raises routed KeyDown on the focused element and Tab via FocusManager.TryMoveFocus).
- 23:57 Failure: DataGrid column headers rendered invisible (white on white) with FluentAvaloniaTheme + DataGrid Fluent.xaml. Workaround: a style in App.axaml setting DataGridColumnHeader Foreground/Background from FA theme brushes.
- 23:57 Failure: CLI 'launch' that owned the app's stdout pipe killed the app when the CLI exited. Replaced with run-slice.sh (detached, output to file) plus CLI 'wait-ready'.
- 23:57 Observation: FANavigationView keeps a selection indicator on Overview after navigating elsewhere (looks like FA issue 579/602 class). Not worked around yet.
- Charts: custom drawn (Charts.cs, DrawingContext), no library; about 25 minutes including hit testing and the keyboard legend.
- 00:02 Selftest (C# in the CLI project) covers G3 end to end: 44 checks. With synthetic keys the dialog Tab/Escape and legend Tab checks failed on the real window; with real OS keys (xdotool under Xvfb) all passed. Cause: my SendKey fallback (routed event plus FocusManager.TryMoveFocus) does not reproduce the real Tab/modal handling; this was a harness limitation, not an app bug. Added --oskeys (xdotool on Linux, keybd_event on Windows).
- 00:02 Foreign Host check: HttpListener answers 404 before app code runs for a Host that does not match its prefix. Accepted 400/403/404 in the test and recorded it.
- 00:02 FINDING for G1/G6: transitive package Avalonia.BuildServices 11.3.2 ships an MSBuild task that POSTs build-time usage data (hashed project name, machine GUID, OS, CI flag) to av-build-tel-api-v1.avaloniaui.net on every build unless AVALONIA_TELEMETRY_OPTOUT=1. README says build-time only. Set the variable in CI. Our earlier local builds did not set it.
- 00:02 Headless: all 44 checks pass using HeadlessWindowExtensions.KeyPress for input.
- 00:02 G2 first bench on Xvfb: worst frame 64.6 ms, RSS 258 MB after two passes, no growth, sorts under 160 ms to rendered frame. Stock DataGrid, no alternative needed.
- 00:19 CI run 3 green on Linux (44/44 x2, headless 44/44, dark, bench) and Windows (real keys 43/43). Earlier runs failed: artifact upload hit root-owned 0600 files from the sudo capture (fixed with chown), and the informational synthetic-key Windows run fails 3 checks by design (continue-on-error).
- 00:19 Captured prototype screenshots with Playwright (iframe, data-theme attribute for dark) and built side-by-sides. Wrote RESULTS.md.

## Follow-up (FOLLOWUP-SPEC.md, Avalonia items)
- 01:14 Started. Copied the follow-up files. Installed at-spi2-core, python3-gi, strace, tcpdump, iproute2 (apt works through the proxy).
- 01:25 A1: first AT-SPI dump showed only the 7 navigation items; no page content at all. Cause confirmed by swapping FANavigationView for a plain ListBox (--plain-nav): the whole page, including the DataGrid, then appears. Fix (--a11y-fix): host the page content beside the nav pane instead of as its Content.
- 01:45 A1: DataGrid rows had no name, no selected state; Avalonia's AT-SPI layer has no Table interface at all, and DataGridRowAutomationPeer has no selection provider. Workaround: LoadingRow sets AutomationProperties.Name, PositionInSet and SizeOfSet; "selected" appended to the name. About 30 lines in total. Time spent on A1 fixes: about 40 minutes.
- 01:55 Failure: Windows follow-up job lost its memory summary because the tee target dir did not exist; fixed (mkdir -p).
- 02:00 A2: read the BuildServices source, decoded a real payload file, ran clean builds in a loopback-only namespace for four variants. Failure: the first A2 script run had no DOTNET_ROOT in a fresh shell, and an early a11y run raced the AT-SPI bus start (needed a 4 s wait).
- 02:20 A3/A4: downloaded the CI artifacts by signed URL and compared screenshots across separate workflow runs.
- 02:30 A5: first Windows sampler run saw zero rows for the app, including loopback. Reason: HttpListener sockets belong to HTTP.sys (System), not the app process. Added a validation output so the sampler's visibility is shown, not assumed.
- Prompts or corrections needed from the user in this follow-up: 1 (the follow-up prompt only). Platform stop-hook reminders to commit were followed.
