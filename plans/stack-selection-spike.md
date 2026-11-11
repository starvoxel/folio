# Plan: Stack selection spike

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-11 |

## Goal

Decide which technology Folio is built on, with evidence, before any stack-specific how-to work starts. The two candidates are Avalonia (C#) and Electron with TypeScript. Background and the wider option survey are in [the framework brief](../knowledge/research/ui-framework-comparison.md). This plan builds the same small slice in each candidate and measures it against gates agreed in advance.

## Principle

Selection spikes answer questions where the answer is uncertain and would change the choice. How-to spikes (can this stack do X) wait until the stack is chosen, because every candidate can do them: atomic writes, a native macOS menu, drag-and-drop CSV, code signing, and similar.

## Decisions so far (Jeremy, 2026-11-11)

- Candidates: Avalonia and Electron with TypeScript. Tauri joins only if Electron fails the privacy or footprint gate (G1, G5).
- Decision rule: pass/fail gates first. A candidate that fails a gate is out. Among those that pass, choose on build effort, then on Jeremy's judgement.
- Execution: one agent session per stack, in parallel, each on its own branch, against the same slice spec and the same time box.

## Scope

- In: the shared slice spec, shared fixture data, one throwaway slice per candidate, a measurement protocol, a results write-up, and a decision record.
- Out: anything in the Phase 2 list below; domain features; the budget file format; installers.
- Slice code is throwaway. It lives on spike branches that do not merge, so no sunk cost carries into the chosen stack. The chosen stack is built properly afterwards, reusing what was learned.

## The shared slice

One app per candidate, built from this spec, reading the same fixture files. It follows the [design notes](../knowledge/product/month-end-review-design.md) for look and the PRD for behaviour.

- Shell: left navigation (Overview, Transactions, Reporting, Net worth, Accounts, Rules & categories, Settings in the footer), top bar with file name, Undo, Redo, Import and month picker as placeholders, light and dark themes, a menu button (H1.4, H1.5, H1.9, H1.14).
- Transactions page: a table of the fixture's 10,000 rows with search, sort by any column, row selection, and a side details panel that opens for the selected row (A and T screens in the prototype). No in-cell editing.
- Reporting page: a donut chart of spending by category and a bar chart of money in versus out by month. Clicking a donut slice, bar or legend row opens the Transactions page filtered to those rows (A1.6, A1.19).
- One dialog: a confirmation dialog opened from a button, with keyboard focus checked on open and closed again with Escape.
- Overview, Accounts and the other pages are placeholders.
- Fixture data: one shared, seeded generator script (stack-neutral) writes `transactions.json` (10,000 rows with mixed-script descriptions, dates, amounts in integer cents, account, category and a note on some rows) and `categories.json`. Both slices load these files. The generator and fixtures are committed on a separate base branch so neither stack builds its own data.

## Gates

A candidate must pass every gate. Thresholds are proposals for Jeremy to adjust before the spikes start.

| #   | Gate                          | Pass condition (proposed)                                                                                                                                                                                                                                  |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Privacy                       | A capture of the running slice (launch, use every page, five minutes idle) shows no connection to anything but loopback on Linux. Windows and macOS are captured where the runner allows it and otherwise run by hand. The app ships no telemetry, licence check or update check. |
| G2  | Grid at scale                 | 10,000 rows scroll without visible stalls (proposed: no frame over 100 ms while scrolling); memory after scrolling the whole grid stays under 400 MB with no sustained growth; sorting any column takes under 500 ms; selection and the side panel work.        |
| G3  | Testable and agent-drivable   | In CI on Linux and one other OS, a test launches the real window, navigates to each page, reads the page's state as structured data, takes a screenshot, and exits cleanly. Two consecutive Linux runs match within a stated pixel tolerance. The dialog takes keyboard focus on open on Linux and Windows. |
| G4  | Charts                        | The donut and bar chart render in light and dark, click-through opens the matching rows, and the legend rows can be reached and activated by keyboard.                                                                                                    |
| G5  | Footprint                     | Recorded for every candidate; fails only above a hard ceiling (proposed: installer over 250 MB, cold start to a usable window over 5 seconds on a CI-class machine, or idle memory over 400 MB).                                                           |
| G6  | Licences and cost             | Every dependency the slice needs is MIT or equivalent and free. No paid component is needed for any slice feature.                                                                                                                                         |

## Measurements recorded for every candidate

Recorded whether or not they gate, in a table in the results write-up:

- Effort: elapsed time and the number of agent iterations (prompts and corrections) to reach a slice that passes the gates.
- Fidelity: side-by-side screenshots of the shell, Transactions and Reporting pages against the prototype, in light and dark.
- Numbers: installer size, cold start, idle memory, memory after a full grid scroll, sort time, build time.
- Dependencies: count of direct and transitive packages, and which are single-maintainer or deprecated.
- Accessibility: whether keyboard navigation reaches every control in the slice, and what the platform's accessibility tree shows for the grid and the chart legend.
- Problems: anything that needed a workaround, with the workaround.

## Tie-break

Among candidates that pass every gate: lower effort wins; if effort is close, Jeremy decides. Considerations Jeremy may weigh, recorded but not scored: wanting to learn TypeScript, a later web build, AI-agent productivity, long-term maintenance risk of the UI libraries, and whether the domain core stays in C#.

## Execution

- Two parallel agent sessions, one per candidate, each started from the same base branch holding the slice spec, the gates and the fixture data.
- Branches (created 2026-11-11, all three empty and sharing one empty commit with no history from `main`, so spike code stays out of the real codebase):
  - `spike/stack-selection-base`: milestone 0 puts the slice spec, gates, results template, fixture generator and fixtures here.
  - `spike/slice-avalonia` and `spike/slice-electron`: one per stack. Neither merges. Because they have no commits of their own yet, each is fast-forwarded to the base once milestone 0 is committed there.
- This plan stays on the `claude/relaxed-volta-biy41e` branch until approved. Milestone 0 copies the spec and gates into the base branch so the sessions do not depend on it.
- The Avalonia branch starts empty, so its session copies the pinned versions and project layout it needs from `main` (global.json, Directory.Packages.props, the `src/` scaffold) as a starting point.
- Time box (proposed): one working session per candidate. Both stop at the same wall-clock limit so effort is comparable. A candidate that has not passed all gates when time runs out reports where it stopped and why.
- Each session keeps a plain effort log (what it tried, what failed, time spent) and fills in the same results template when it ends.
- Avalonia starts from the existing scaffold and its pinned versions. Electron starts from a current Electron, TypeScript, Vite and Playwright setup. Library choices inside each slice are the agent's, within gate G6, and are recorded.
- After both finish, one review pass compares the results against the gates, writes [the results brief](../knowledge/research/stack-selection-results.md) and proposes a decision. Jeremy decides. The decision goes into [the architecture decisions](../knowledge/architecture/09_architecture_decisions.md) and updates the constraints and risks.

## Milestones

### 0. Prepare

- Does: commit the slice spec and gates, the fixture generator and the fixtures on a base branch; agree thresholds with Jeremy; write the results template.
- Acceptance criteria: both sessions can start from the base branch with no other input; the generator produces identical files from the same seed.
- Verified by: a run of the generator twice with matching checksums.

### 1. Build both slices

- Does: the two parallel sessions build to the spec and record the measurements.
- Acceptance criteria: each branch has a runnable slice, a filled-in results template and a CI run for G3.
- Verified by: the CI runs and the measurement tables.

### 2. Review and decide

- Does: compare against the gates, run the network capture (G1) on both if a session has not, write the results brief, recommend, and record the decision.
- Acceptance criteria: a decision record exists, the losing branch is kept as reference only, and plans for the next phase exist.
- Verified by: Jeremy's approval.

## Phase 2: how-to spikes (after the decision)

Not started. Each list is revisited after the decision, and only the chosen path's list is planned.

- If Avalonia:
  - Compiled bindings, trimming and System.Text.Json source generation.
  - The full automation server, CLI and headless mode (AD-16), including the release-build enabling step and the credential-store check.
  - The FluentAvalonia wrappers (AD-15), fonts and theme resources.
  - The Fluent2 look-ahead, only if FluentAvalonia stays.
  - DataGrid workarounds found in selection.
- If Electron with TypeScript:
  - The hardening set and a CI network-capture test that runs on every Electron update (the briefing's section 9.1).
  - The preload and IPC bridge design, and its input validation.
  - Playwright against a fuse-hardened build, or a separate test build.
  - The platform-neutral core with a `FileStore` interface for desktop and a later web build.
  - Code signing, notarization and an opt-in update check.
- Either way:
  - The `.folio` file format, atomic writes, backups and the in-use file.
  - The native macOS menu and drag-and-drop CSV import.
  - The synthetic household generator and per-provider CSV fixtures, which are prerequisites more than spikes.

## What happens to the existing plans

- [stack-spike.md](stack-spike.md) is paused. Its milestone 3 (the grid test) is replaced by gate G2 here. Milestones 1, 2, 4, 5 and 6 become Phase 2 work under the Avalonia path, reworked or dropped if it loses.
- [regression-suite.md](regression-suite.md) is blocked on this decision, because its driver and runner setup depend on the chosen stack.
- AD-13 to AD-16 and the pinned-stack constraints stay as they are until the decision record changes them.

## Open questions

- Are the gate thresholds right, especially the 100 ms frame limit, the 500 ms sort time and the footprint ceilings? [Jeremy, before milestone 0]
- What is the time box per candidate? [Jeremy, before milestone 1]
- Should the Avalonia slice use FluentAvalonia, or Avalonia's built-in theme, given the plan to compare maintenance risk? [Jeremy, before milestone 1]
- Which design system does the Electron slice use: Fluent UI React to match the prototype, or another? [Jeremy, before milestone 1]
