# Plan: Stack spike

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by | Pending    |
| Created     | 2026-11-05 |

## Goal

Prove the pinned UI stack (Avalonia 12.1.5, FluentAvalonia 3.1.0, DataGrid 12.1.2, .NET 10) works for this app on Windows, macOS and Linux before feature work depends on it, and build the first real pieces of the shell: the FluentAvalonia wrappers from AD-15 and a minimal automation server and CLI from AD-16. Known upstream bugs (FluentAvalonia #766, #777, NavigationView alignment; DataGrid #228, #248) are checked against our usage, not assumed.

## Scope

- In: the app shell with the wrappers, theme and fonts; a DataGrid stress test; compiled bindings with trimming and JSON source generation; a minimal automation server, CLI and headless mode; a throwaway look at Avalonia 12.2's Fluent2 theme.
- Out: any domain feature (accounts, import, categorization and the rest); the budget file format; installers and packaging.

## Approach

Spike code that proves a point and is worth keeping goes into `src/`. Throwaway experiments (Fluent2 alongside FluentAvalonia, TableView comparison) live on a separate branch and are only reported. Findings update [11_risks.md](../knowledge/architecture/11_risks.md) and, where a decision changes, [09_architecture_decisions.md](../knowledge/architecture/09_architecture_decisions.md). Affected arc42 sections: 04, 09 (AD-13, AD-15, AD-16), 11.

## Milestones

### 1. Shell and wrappers

- Does: `AppShell` around `FANavigationView`, with our own navigation-item model and the six nav items plus Settings in the footer (H1.4); `IDialogService` around `FAContentDialog`; `AppBanner` around `FAInfoBar`; `AppIcon`; the top bar with file name, unsaved indicator, Undo, Redo, Import and month picker as placeholders (H1.5); the hamburger menu (H1.14); a macOS `NativeMenu` (H1.16); light, dark and system themes. Every FluentAvalonia type stays under `Ui/Fluent/`.
- Acceptance criteria: the shell runs on Windows, macOS and Linux (X11 and Wayland); navigation and theme switching work; a dialog takes keyboard focus on open, or a workaround for #766 is in place and documented; NavigationView alignment is recorded with screenshots per OS; the isolation test still passes.
- Verified by: headless tests for navigation and dialog view-models; screenshots per OS attached to the PR; the manual focus check written up in the PR.

### 2. Fonts and theme resources

- Does: decide Inter versus the platform font (design notes leave it open); embed it alongside FluentAvalonia's symbol font if chosen; define the app aliases (`App.CardBrush` and the status backgrounds the prototype adds) in the app-owned theme file.
- Acceptance criteria: text and icons render correctly in both themes on all three OSes; the #777 font-override caveat is either avoided or worked around and documented.
- Verified by: screenshots; a headless test that the app aliases resolve in light and dark.

### 3. Transactions grid stress test

- Does: a Transactions-style DataGrid with 10,000 synthetic rows (mixed-script descriptions, dates, amounts, 6 to 8 columns), sorting, selection and a side details panel; on the spike branch, the same data in TableView for comparison.
- Acceptance criteria: scrolling stays smooth; memory after scrolling the whole grid stays under a stated limit (proposed 400 MB) with no sustained growth, which tests DataGrid #228; sorting works; editing happens in the side panel only.
- Verified by: a recorded memory profile and timings in the PR; headless tests for sort and selection view-model behaviour.

### 4. Compiled bindings, trimming and source generation

- Does: confirm compiled bindings everywhere (`x:DataType`); a trimmed self-contained publish for one OS; a System.Text.Json source-generated round trip of a sample model in Core.
- Acceptance criteria: the trimmed build starts and shows the shell with no trim warnings left unexplained; the JSON round trip test passes.
- Verified by: the publish command and warning list in the PR; a Core unit test.

### 5. Automation server, CLI and headless mode

- Does: create `MEFR.Automation` and `MEFR.Cli`; decide the HTTP stack (Kestrel minimal APIs versus `HttpListener`); `--automation` starts a loopback-only server with a per-session token file readable only by the user; endpoints for `status`, `ui navigate`, `ui state` and `ui screenshot`; `--headless --automation` runs on the headless platform; the `mefr` CLI finds the running app and calls these.
- Acceptance criteria: without `--automation` nothing listens (checked); the server refuses requests without the token and refuses non-loopback connections; `mefr ui navigate Reporting` then `mefr ui screenshot` produces a PNG of the Reporting placeholder from a headless run in CI.
- Verified by: integration tests in CI that start the headless app, drive it through the CLI and check the JSON and the PNG; a test that the port is closed without the flag.

### 6. Fluent2 look-ahead (throwaway)

- Does: on a spike branch, load Avalonia's Fluent2 theme from Avalonia's CI builds alongside FluentAvalonia and record what conflicts.
- Acceptance criteria: a short write-up with screenshots of conflicts, added to [11_risks.md](../knowledge/architecture/11_risks.md) under R3.
- Verified by: the write-up; nothing from this branch merges.

## Requirements

- Security: the automation server binds to `127.0.0.1` only, generates a fresh random token per session, stores it in a file with user-only permissions, rejects requests without it, limits request size, and serves no files. Without the flag no listener exists. The csharp_base security checklist applies.
- Logging: Microsoft.Extensions.Logging with the standard format; the automation server logs start, stop and rejected requests at Info and Warning; no financial data in any log.

## Open questions

- Inter or the platform default font? [Jeremy, at milestone 2]
- Kestrel or `HttpListener` for the automation server? [Engineer proposes at milestone 5; Jeremy approves, because it adds a framework dependency]
- Should release builds include the automation server (inert without the flag) or only debug and test builds? [Jeremy]
- Which CI runners can show a real window for the per-OS screenshot checks, or do those stay manual? [Engineer, at milestone 1]
