# Plan: UI regression suite

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-11 |

## Goal

A small, fast regression suite that runs the real Folio app and checks it still works. Its first job is to tell us whether a Dependabot update (Electron, React, Fluent UI, ECharts, TanStack, Playwright, GitHub Actions) broke the app or changed what it does on the network. Its longer-term job is UI regression testing with the same tools agents use to inspect the app. It must be free, run on GitHub, and make new scenarios cheap to add.

## Decisions so far

- Purpose: dependency-update breakage first, UI regressions later.
- Driver: Playwright, attached to the packaged release binary through Chromium's debugging pipe, with the `window.__folio` state hook and the debugging guard of [AD-16](../knowledge/architecture/09_architecture_decisions.md#ad-16-testing-and-drivability-without-a-network-port). Domain-level scenarios run through the core CLI with no window.
- Images: pixel comparison against baselines kept per operating system, because fonts and rendering differ by OS. Electron pins Chromium, so baselines move only when Electron is updated.
- Platforms: Windows and macOS runners run the end-to-end suite; Linux runners run the fast kinds (lint, type check, architecture, unit, integration). Linux is not a v1 platform.
- Cadence: a short smoke subset on every pull request, the full suite nightly and on demand.
- The repository is public, so hosted runners are free on all three OSes.
- First scenarios: launch and main window; open or create a `.folio` file; import a provider CSV; dialogs and focus.

## Scope

- In: the end-to-end suite, per-OS screenshot comparison, a baseline-update workflow, CI workflows, Dependabot gating, and the rule that every Electron update runs the privacy capture (AD-18).
- Out: performance and stress testing (a separate initiative, see [the research brief](../knowledge/research/performance-and-e2e-testing.md)); OS-level accessibility drivers; Linux and web suites (later).

## Approach

### Harness

- Playwright projects under `tests/e2e/` (AD-14), outside the default unit and integration run. Each test starts the packaged release binary with `FOLIO_AUTOMATION=1`, attaches through the debugging pipe relayed by the test process, drives the app by role, name and test ID, reads state through the hook, and closes the app.
- A scenario is a short function: open a fixture, navigate, assert on the state JSON, optionally capture and compare a screenshot. Adding a scenario needs no new infrastructure.
- Input data comes from the seeded synthetic household generator and the provider CSV fixtures named in the performance brief.

### Display

- Windows and macOS hosted runners have a desktop session, so no extra setup. Whether macOS produces a real window on hosted runners was shown in the selection spike (it does, with a small display).

### Image comparison

- Capture at a fixed window size, scale and theme. Compare with a small per-pixel tolerance and a failure threshold on the share of differing pixels (the spike used 0.1% and two consecutive runs matched). On failure upload actual, expected and a diff.
- Baselines update through a manual workflow that regenerates images on the matching runner and opens a pull request, so changes are reviewed like code. Baselines change when Electron changes.

### CI

- `e2e.yml`: the smoke subset on every pull request on Windows and macOS; the full suite nightly and on demand. Actions are pinned to commit SHAs.
- Dependabot: Electron updates arrive in their own group and run the full suite and the privacy capture before merge. The patch group keeps its auto-merge, which waits on the same required checks.
- Flakiness policy: no retries that hide a failure; at most one automatic retry of the whole job, and a flaky scenario is fixed or removed, never skipped.

## Milestones

Depends on the [app scaffold plan](app-scaffold.md), milestone 4 (the desktop app and its smoke test).

### 1. Harness and launch scenario

- Does: the Playwright harness, app start and stop, and the first scenario (launch, main window renders, shell state is as expected).
- Acceptance criteria: runs locally and on Windows and macOS CI in under a stated time (proposed 90 seconds).
- Verified by: a green `e2e.yml` run on a pull request.

### 2. Screenshot comparison and baselines

- Does: fixed capture settings, the comparer, artifacts on failure, the baseline-update workflow, and baselines for the launch scenario in light and dark on each OS.
- Acceptance criteria: two consecutive runs produce no pixel failures on each OS; a deliberate change fails with a diff artifact.
- Verified by: those two runs and one intentional failure shown in the pull request.

### 3. File and import scenarios

- Does: open or create a `.folio` file, and import a provider CSV, with assertions on state and key screenshots. Needs the file format (AD-2) and the CSV fixtures.
- Acceptance criteria: each scenario passes on both OSes; adding a scenario takes a single file.
- Verified by: green CI.

### 4. Dialogs and focus

- Does: scenarios that open dialogs and check keyboard focus, using real key events where the platform allows.
- Acceptance criteria: the focus assertion fails against a deliberately broken dialog, to show it can catch a regression.
- Verified by: the nightly result on both OSes.

### 5. Dependabot gating

- Does: the suite and the privacy capture become required checks for the Electron group and the minor groups, and the patch group's auto-merge keeps waiting on them.
- Acceptance criteria: a test Dependabot-style Electron bump shows the check results on the pull request; the suite runs clean for two weeks before it becomes required.
- Verified by: the run history.

## Risks

- A required check that flakes blocks every Dependabot pull request. Mitigation: keep it out of the required set until it has run clean for two weeks.
- macOS and Windows runners have no GPU and a small display, so baselines come from a configuration unlike a real desktop. Mitigation: treat screenshots as regression guards between runs on the same runner image, not as proof of how the app looks on a user's machine; a runner-image update may require a baseline refresh.

## Open questions

- Which window size, scale and theme set defines the baseline images? [Engineer, at milestone 2]
- Should the suite be a required check for all pull requests or only Dependabot's? [Jeremy, after milestone 5]
