# Follow-up spec: close the comparison gaps

Both slices are built and have a `RESULTS.md`. A review of the two found measurements that are not comparable, things neither session measured, and open questions in each. This follow-up closes the gaps that could change the decision. It is not a new feature build.

Read `SLICE-SPEC.md` first (hard constraints and working rules still apply), then your own `RESULTS.md`. Continue on your own branch. Do not use subagents. Do not change the verdicts already in `RESULTS.md`; report new findings in `FOLLOWUP-RESULTS.md` (copy `FOLLOWUP-RESULTS-TEMPLATE.md`). If a new finding shows an earlier statement was wrong, add a "Corrections" section at the top of `FOLLOWUP-RESULTS.md` and say so plainly.

## Why this follow-up exists

1. G2 memory was measured differently: one session used a single-process RSS, the other summed working sets across processes (which counts shared pages several times). One of them failed the 400 MB limit by about 3 to 4 MB under a fair metric. The metric must be the same.
2. Neither session measured the platform accessibility tree. Accessibility was a stated concern about Avalonia (DataGrid rows and cells are not reachable through UI automation, issue 267), and it has no gate.
3. Neither session ran on macOS.
4. Avalonia's results had a few unchecked claims (its own CI evidence, cross-run screenshots, the build-time telemetry details). Electron's had open questions (one non-loopback `connect()`, the tested binary differing by one fuse, no Chromium sandbox on Linux CI).

Report raw numbers and findings. Do not tune anything to improve a number, and do not shrink or restructure the app to pass a threshold. The decision is made afterwards by someone else.

## F1. Memory measured the same way for both stacks

Measure on the same app builds and scenario as `RESULTS.md`, on the GitHub-hosted Linux and Windows runners (no GPU, software rendering), plus macOS if F2 works.

Points to record (for both stacks), after the app is ready:

| Point | When                                                                                  |
| ----- | ------------------------------------------------------------------------------------- |
| P0    | Overview page, 5 s after ready                                                        |
| P1    | Transactions page open, 5 s after navigating                                          |
| P2    | After the first full scroll of 10,000 rows, 3 s later                                 |
| P3    | After the second full scroll, 3 s later                                               |
| P4    | After the third scroll and a 60 s idle                                                |
| P5    | After a soak: 20 more full scrolls with one sort and one filter change between each, then 60 s idle |

Metric per OS (use the whole process tree of the app: the root process and every descendant):

- Linux: sum of PSS. Use `tools/measure-memory.py <root-pid>` (copied from the base branch). Also record the summed RSS for reference.
- Windows: sum of private working set per process (the "Working Set - Private" performance counter, or `PrivateMemorySize64` and working-set values from the process API; say exactly which). Also record the summed total working set for reference.
- macOS: sum of physical footprint (`footprint -p <pid>`, or the closest equivalent; say exactly which). Also record summed RSS from `ps`.

Rules:

- Measure with accessibility off (the default) for the headline numbers. Electron also needs a second set with Chromium's accessibility forced on (for example `--force-renderer-accessibility`), because a screen reader turns that on; for Avalonia record whether any setting changes memory when an assistive technology is attached, or say you could not test it.
- Report all points for each OS in one table, and report pass or fail against the 400 MB limit for each metric, without redefining the limit. Which metric the limit applies to is a decision for Jeremy; give him the numbers for all of them.
- Write down the exact commands, and keep the measurement code in the repo so it can be rerun.

## F2. macOS run

Run the same app on a GitHub-hosted macOS runner (`macos-latest`, arm64; free for a public repo). Goals, in order:

1. Does the app build and start on macOS, and does it create a real window on a hosted runner (no logged-in user may mean it cannot)? Record exactly what happened.
2. If it runs: cold start, the F1 memory points with the macOS metric, and the G3 scenario as far as it can go. Say which parts of G3 could not run (for example real key events may need an accessibility permission the runner does not grant).
3. Screenshots of every page in light and dark, uploaded as artifacts.
4. A best-effort network observation over launch, use of every page and a 5-minute idle (for example `tcpdump` with the app's PID attributed through `nettop` or `lsof`). The hosted runner has its own background traffic, so attribute by process and say how confident the result is.
5. Native menu bar: not required for this spike.

If macOS cannot be run at all on a free hosted runner, say exactly why and what was tried; that is itself a finding.

## F3. Platform accessibility tree

Dump what the operating system's accessibility API actually reports for the running app, not what the app's code says it exposes. Elements to inspect, the same list for both stacks:

1. A navigation item and the Settings footer item.
2. The top-bar menu button and the search box.
3. A filter drop-down.
4. The Transactions grid: the container, a column header, one data row, and a cell in it. For each: role, name, value, selected state, and the row or column index and count if reported. Also say whether all 10,000 rows are announced as the size of the table, and what changes as the grid scrolls.
5. The details panel contents for a selected row.
6. A donut legend row, and a bar or its month button.
7. The confirmation dialog: its role, label, and where keyboard focus is when it opens.

Do this on:

- Linux: AT-SPI through the accessibility bus (for example `python3` with `gi` and `Atspi`, or `accerciser`-style tooling run under `dbus-run-session` and Xvfb). You may have to turn the accessibility bus on for the app to publish its tree; say what you had to do.
- Windows: UI Automation (for example a PowerShell script using `System.Windows.Automation`, or `inspect.exe` if available on the runner), dumped as text.
- macOS: the accessibility hierarchy through the system API (for example a small Swift or AppleScript tool). This may be blocked by a permission on the hosted runner; say so if so.

Output: a table per OS (element, role, name, value, state, notes) in `FOLLOWUP-RESULTS.md`, with raw dumps under `<stack>/evidence/a11y-platform/`. Then answer in plain words: could a screen-reader user find a transaction, read its description, amount and category, and know which row is selected? What is missing?

Stretch, only after the dumps are done and only for about 30 minutes: try a real screen reader in CI (NVDA on the Windows runner, VoiceOver on macOS, Orca on Linux), for example with a tool such as Guidepup. Check that the tool is current and free before relying on it. Report what the screen reader announced for the grid and the dialog, or why it could not run.

## Stack-specific items

See your own prompt (`prompts/followup-avalonia.md` or `prompts/followup-electron.md`).

## Reporting

- `FOLLOWUP-RESULTS.md` on your branch, committed and pushed. Everything marked measured, not measured (with a reason), or inferred.
- Keep `EFFORT-LOG.md` going: add follow-up entries and say how many prompts or corrections you needed.
- Raw evidence under `<stack>/evidence/`. Do not commit large binaries; a few screenshots and text dumps are fine.
- CI: reuse your existing workflow, adding a macOS job. Pin new third-party actions to full commit SHAs with the release in a comment. Free hosted runners only.
- If you are blocked or something fails, stop that item, record it, and move on to the next. Finish by summarizing where each item stands.
