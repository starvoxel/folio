# Effort log: Avalonia slice

Times are UTC from the session clock. Prompts or corrections from the user: **1** (the kickoff prompt only; none since).

- 23:50 Session start. Read spec, README, template, product context. Machine had no .NET; installed SDK 10.0.404 with dotnet-install (global.json pins 10.0.100, rollForward latestFeature). No xdotool on the box.
- 23:50 Scaffolded avalonia/ (Directory.Build.props, central package pins: Avalonia 12.1.5, DataGrid 12.1.2, FluentAvaloniaUI 3.1.0). Relaxed for the spike: TreatWarningsAsErrors off, no strict analyzers.
- 23:57 First full build compiled after ~6 fix rounds (API renames in Avalonia 12/FA 3: no FluentTheme without Avalonia.Themes.Fluent so only FluentAvaloniaTheme is used; FANavigationView*, FAContentDialog; no public way to inject raw key events on a real window so SendKey raises routed KeyDown on the focused element and Tab via FocusManager.TryMoveFocus).
- 23:57 Failure: DataGrid column headers rendered invisible (white on white) with FluentAvaloniaTheme + DataGrid Fluent.xaml. Workaround: a style in App.axaml setting DataGridColumnHeader Foreground/Background from FA theme brushes.
- 23:57 Failure: CLI 'launch' that owned the app's stdout pipe killed the app when the CLI exited. Replaced with run-slice.sh (detached, output to file) plus CLI 'wait-ready'.
- 23:57 Observation: FANavigationView keeps a selection indicator on Overview after navigating elsewhere (looks like FA issue 579/602 class). Not worked around yet.
- Charts: custom drawn (Charts.cs, DrawingContext), no library; about 25 minutes including hit testing and the keyboard legend.
