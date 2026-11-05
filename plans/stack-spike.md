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

- Does: `AppShell` around `FANavigationView`, with our own navigation-item model and the six nav items plus Settings in the footer (H1.4); `IDialogService` around `FAContentDialog`; `AppBanner` around `FAInfoBar`; `AppIcon`; the top bar with file name, unsaved indicator, Undo, Redo, Import and month picker as placeholders (H1.5); the hamburger menu (H1.14); a macOS `NativeMenu` (H1.16); light, dark and system themes. Every FluentAvalonia type stays under `UI/Fluent/`.
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

- Does: create `Folio.Automation` and `Folio.Cli`. `--automation` starts a loopback-only server on `127.0.0.1` built on .NET's `HttpListener` (no added dependency), with a fresh token per session written with the port and process id to a discovery file readable only by the user (`chmod 600` on macOS and Linux; per-user AppData on Windows). Endpoints: `status`, `ui navigate`, `ui state` and `ui screenshot`. Every request handler reaches the model and view-models only through one helper that marshals onto the UI thread (`Dispatcher.UIThread.InvokeAsync`). Screenshots use `CaptureRenderedFrame()` when headless and render the window's content to a bitmap otherwise. `--headless --automation` runs the real app on Avalonia's headless platform with Skia rendering. Page view-models expose state and named actions through an explicit automation interface (no reflection, trim-safe); a test fails if a page view-model does not implement it. The `folio` CLI reads the discovery file, calls the server and prints JSON.
- Already proven (2026-11-05, throwaway probe on Avalonia 12.1.5 headless + Skia + `HttpListener`): a headless app answered state, navigated, returned a correct PNG and shut down cleanly over loopback HTTP. Remaining unknown: that a non-admin user on Windows can listen on `http://127.0.0.1:<port>/` with `HttpListener` without a URL reservation. If not, swap in Kestrel minimal APIs behind the same handler code.
- Acceptance criteria: without `--automation` nothing listens (checked); the server refuses requests without the token and refuses non-loopback connections; `folio ui navigate Reporting` then `folio ui screenshot` produces a PNG of the Reporting placeholder from a headless run in CI.
- Verified by: integration tests in CI that start the headless app, drive it through the CLI and check the JSON and the PNG; a test that the port is closed without the flag; the `HttpListener` loopback check on the Windows CI runner.

### 6. Fluent2 look-ahead (throwaway)

- Does: on a spike branch, load Avalonia's Fluent2 theme from Avalonia's CI builds alongside FluentAvalonia and record what conflicts.
- Acceptance criteria: a short write-up with screenshots of conflicts, added to [11_risks.md](../knowledge/architecture/11_risks.md) under R3.
- Verified by: the write-up; nothing from this branch merges.

## Requirements

- Security: the automation server binds to `127.0.0.1` only, generates a fresh random token per session, stores it in a file with user-only permissions, rejects requests without it, limits request size, and serves no files. Without the flag no listener exists. The csharp_base security checklist applies.
- Logging: Microsoft.Extensions.Logging with the standard format; the automation server logs start, stop and rejected requests at Info and Warning; no financial data in any log.

## Open questions

- Inter or the platform default font? [Jeremy, at milestone 2]
- HTTP stack: `HttpListener` recommended (proven in the probe, no dependency); Kestrel only if the Windows loopback check fails. [Jeremy approves with the plan]
- Should release builds include the automation server (inert without the flag) or only debug and test builds? [Jeremy]
- Which CI runners can show a real window for the per-OS screenshot checks, or do those stay manual? [Engineer, at milestone 1]
