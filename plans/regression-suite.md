# Plan: UI regression suite

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-11 |

## Goal

A small, fast regression suite that runs the real Folio app and checks it still works. Its first job is to tell us whether a Dependabot update (Avalonia, FluentAvalonia, DataGrid, .NET packages, GitHub Actions) broke the app. Its longer-term job is UI regression testing, with the same automation CLI used for precise manipulation and UI analysis. It must be free, run on GitHub, and make new scenarios cheap to add.

## Decisions so far (Jeremy, 2026-11-11)

- Purpose: dependency-bump breakage first, UI regressions later.
- Driver: the AD-16 automation server and `folio` CLI, against the real app with a real window (not `--headless`), so the suite sees actual rendering. The suite waits for AD-16 (stack spike milestone 5); no interim Avalonia.Headless suite is built.
- Images: pixel comparison for proper regression. Baselines are Linux-only, on a pinned runner image. Other OSes run the same scenarios and save screenshots as artifacts, with no pixel failure.
- Cadence: every PR on Linux; all three OSes nightly and on demand.
- Repository is public, so hosted runners are free on all three OSes.
- First scenarios: launch and main window; open or create a `.folio` file; import a provider CSV; dialogs and focus (FluentAvalonia #766).

## Scope

- In: scenario project, CLI-driven test harness, screenshot comparison, CI workflows, a baseline-update workflow, Dependabot integration.
- Out: performance and stress testing (separate initiative, see [the research brief](../knowledge/research/performance-and-e2e-testing.md)); real OS-level input automation (Appium, FlaUI), unless a later decision adds a few tests; visual testing on Windows and macOS.

## Approach

### Harness

- Scenarios are xUnit v3 tests in a new project outside the default `Folio.slnx` run (for example `tests/E2E/` with its own `E2E.slnx`). The `TestLayoutTests` architecture rule gets a fourth allowed kind, so this is an AD-14 amendment.
- Each test starts the app with `--automation`, waits for the port and token file, drives it with the same calls the `folio` CLI makes (a small client library shared with `Folio.Cli`), then shuts it down. Tests never touch the UI tree directly, so a UI change breaks a scenario only where its behavior changed.
- A scenario is a short method: open fixture, navigate, assert on `ui state` JSON, optionally `ui screenshot` and compare. Adding a scenario should not need new infrastructure.
- Input data comes from the deterministic synthetic household generator and the provider CSV fixtures named in the research brief (prerequisites 1 and 5).

### Display

- Linux: run under Xvfb (`xvfb-run`) so the app has a real window. The runner image is pinned (for example `ubuntu-24.04`, not `ubuntu-latest`) and the app's fonts are bundled, so rendering is stable.
- Windows and macOS: hosted runners have a desktop session, so no extra setup. Whether macOS shows a window without a logged-in user is to be proven in a spike.

### Image comparison

- Capture through `ui screenshot` at a fixed window size, scale and theme. Compare against baselines in `tests/E2E/Baselines/` with a small per-pixel tolerance and a failure threshold on the share of differing pixels. The comparer is small enough to write ourselves; Verify.Avalonia is not needed (Avalonia 12 support unverified).
- On a failure the test uploads actual, expected and a diff image as artifacts.
- Baselines update through a manual workflow (`workflow_dispatch`) that regenerates images on the pinned Linux runner and opens a PR, so the diff is reviewed like code.
- Windows and macOS runs attach screenshots only.

### CI

- `e2e.yml`: on `pull_request`, Linux only, required check once stable. Nightly `schedule` and `workflow_dispatch` run the Linux, Windows and macOS matrix. Actions are pinned to commit SHAs like the existing workflows.
- Dependabot: the suite becomes a required check for the minor groups and Avalonia PRs, which already stay manual. The patch group auto-merge keeps working only if the suite passes, since it needs the same required checks. Test results and screenshots upload as artifacts so a Dependabot PR can be reviewed without running it locally.
- Flakiness policy: no retries that hide a failure; one automatic retry of the whole job at most, and a flaky scenario is fixed or removed, never skipped.

## Milestones

Depends on stack spike milestone 5 (automation server, CLI, `--headless` and windowed modes).

### 1. Harness and launch scenario

- Does: the E2E project, the client library, app start and stop, and the first scenario (launch, main window renders, shell state is as expected).
- Acceptance criteria: runs locally and on Linux CI under Xvfb in under a stated time (proposed 60 seconds); the architecture layout rule is amended.
- Verified by: a green `e2e.yml` run on a PR.

### 2. Screenshot comparison and baselines

- Does: fixed capture settings, the comparer, artifacts on failure, the baseline-update workflow, and baselines for the launch scenario in light and dark.
- Acceptance criteria: two consecutive Linux runs produce no pixel failures; a deliberate one-pixel-group change fails with a diff artifact.
- Verified by: those two runs and one intentional failure shown in the PR.

### 3. File and import scenarios

- Does: open or create a `.folio` file, and import a provider CSV, with assertions on state and key screenshots. Needs the file format (AD-2) and the CSV fixtures.
- Acceptance criteria: each scenario passes on Linux; adding a scenario takes a single file.
- Verified by: green CI.

### 4. Dialogs and focus

- Does: scenarios that open dialogs and check keyboard focus (FluentAvalonia #766), plus a nightly check on all three OSes.
- Acceptance criteria: the focus assertion fails against a build with the known bug, to show it can catch it.
- Verified by: the nightly matrix result.

### 5. Three-OS nightly and Dependabot gating

- Does: the nightly Linux, Windows and macOS matrix, screenshot artifacts on the non-Linux runs, and the suite as a required check for manual Dependabot groups.
- Acceptance criteria: nightly runs for a week without unexplained failures; a test Dependabot-style bump shows the check result on the PR.
- Verified by: the run history.

## Risks

- AD-16 slips, and so does everything here. Mitigation: milestone 1 only needs the launch and state calls, which are the first part of the server.
- Pixel diffs from font or renderer changes on a runner image update. Mitigation: pinned image, bundled fonts, tolerance, and a reviewed baseline-update workflow.
- macOS and Windows runners may not give a usable window for screenshots. Mitigation: they only attach screenshots, and a spike in milestone 5 decides what they check.
- A required check that flakes blocks every Dependabot PR. Mitigation: keep it out of the required set until it has run clean for two weeks.

## Open questions

- Which window size, scale and theme set defines the baseline images? [Engineer, at milestone 2]
- Does a windowed run under Xvfb support the focus checks for #766, or do those need Windows? [Engineer, at milestone 4]
- Should the suite be a required check for all PRs or only Dependabot's? [Jeremy, after milestone 5]
