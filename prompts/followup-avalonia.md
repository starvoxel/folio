# Follow-up prompt: Avalonia slice

Paste everything below the line into the existing Avalonia session (resume it) or a new session on this repository.

---

Your Avalonia slice and `RESULTS.md` were reviewed against the Electron slice. The review found gaps that could change the stack decision. This follow-up closes them. It is measurement and investigation, not new features. The same rules as before apply: stay on your own branch, never push elsewhere or open a pull request, no subagents, report honestly, and do not tune anything to improve a number.

Start here:

1. `git fetch origin && git checkout spike/slice-avalonia`.
2. Copy the follow-up files into your branch: `git checkout origin/spike/stack-selection-base -- FOLLOWUP-SPEC.md FOLLOWUP-RESULTS-TEMPLATE.md tools/measure-memory.py`, and commit them.
3. Read `FOLLOWUP-SPEC.md` in full. Do items F1 (memory, same method), F2 (macOS) and F3 (platform accessibility tree) as written there, then the Avalonia-specific items below. Write everything to `FOLLOWUP-RESULTS.md` (from `FOLLOWUP-RESULTS-TEMPLATE.md`), and keep `EFFORT-LOG.md` going. Do not edit the verdicts already in `RESULTS.md`; use a Corrections section if something was wrong.

Avalonia-specific items:

- **A1. DataGrid accessibility (the main open risk).** Issue 267 says the DataGrid's rows and cells are not exposed through UI automation. F3 asks what the platform tree actually shows. For the grid specifically, report on Linux (AT-SPI) and Windows (UI Automation): is the grid exposed as a table or grid, are rows and cells reachable, do cells have readable text, is the selected row indicated, and are row and column counts reported? If rows or cells are missing, spend no more than about 45 minutes on the least invasive free fix (for example custom automation peers for the rows and cells, or a free replacement grid; exclude paid components). Show whether it works and how much code it took. Do not build a full replacement.
- **A2. Build-time telemetry, verified.** Your `RESULTS.md` says `Avalonia.BuildServices` sends build-time data, including a machine GUID and a hashed machine name. Check it. Read the task's source (the Avalonia.BuildServices repository) and list the fields it actually sends and the endpoint. Then observe a clean build with and without `AVALONIA_TELEMETRY_OPTOUT=1` in a network-captured Linux namespace and report what connections appear. Find the most robust way to turn it off for every build (an MSBuild property or environment setting in `Directory.Build.props`, for example) and show it working. Confirm the published app output contains the telemetry task or not, and that the running app never contacts the endpoint. If the Accelerate community tooling changes this behavior, say so.
- **A3. Evidence you did not open.** Download and read the `g1-evidence`, `linux-evidence` and `windows-evidence` artifacts from your CI run, and confirm or correct what `RESULTS.md` says about them.
- **A4. Cross-run screenshot stability.** Your Linux comparison was between two runs inside one job. Compare screenshots between two separate workflow runs on identical code (for example re-run the workflow, or push a docs-only commit) and report the pixel difference with your tolerance stated. Do the same for Windows.
- **A5. Windows network capture, best effort.** Capture the app's network activity on the Windows runner over launch, use of every page and five minutes idle (for example by polling `Get-NetTCPConnection`, `netstat` or ETW, attributing connections by process). State how confident the result is, and the runner's own background traffic.
- **A6. Maintenance facts you did not check.** Look up, from the GitHub repositories and package pages, for FluentAvaloniaUI and Avalonia.Controls.DataGrid: the date of the last commit and last release, how many people have committed in the last 12 months, the count of open issues, and the dates and nature of the most recent maintainer statements. Give links.

When you finish each item, commit and push. Finish with a summary of what changed in the picture compared with `RESULTS.md`.
