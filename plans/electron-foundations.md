# Plan: Electron foundations

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-12 |

## Goal

Prove the parts of the Electron architecture that every feature will lean on, before feature work depends on them: the privacy capture on every platform we ship, the real host implementations behind the host interface, the testing layers, a read-only web build of the same renderer, and a usable install experience for the household. Each item is a how-to spike on a stack that has already been chosen, in the order the risks suggest.

## Scope

- In: the CI network capture and its analyzer; atomic save, lock file and backups in the main process; the macOS menu and file-drop import; domain scenario tests and the Playwright harness beyond the smoke test; the guard's early-attach check; a web build that reads a file in the browser; the Windows and macOS install experience.
- Out: product features; signing and notarization; auto-update; Linux (a later plan, see AD-20); a server backend (AD-19).

## Approach

This plan follows the [app scaffold plan](app-scaffold.md), which provides the workspace, the shell and the smoke test. The selection slices on the `spike/slice-*` branches hold working scripts to read for lessons: the Linux namespace capture and its analyzer (`electron`), the per-process socket samplers for Windows and macOS (the Tauri and Avalonia slices), and the memory scripts. They are reference only. Decisions: AD-16, AD-18, AD-19, AD-20. Affected arc42 sections: 03, 09, 11 (R3, R4, R5, R14).

## Milestones

### 1. The privacy capture in CI

- Does: a job that runs the built app in an isolated Linux network namespace with `strace` on network syscalls and `tcpdump`, a sink route so an attempt would be emitted, a positive control, and an analyzer that reports non-loopback `connect()` calls and external DNS queries, with the Chromium IPv6 reachability notice allowlisted. It runs through launch, every page and five minutes idle, and on every Electron update. For Windows and macOS: per-process socket sampling of the app and every web-process descendant, validated with a positive control (navigating the window to an external address must be seen), and a documented statement of what cannot be observed from a runner.
- Acceptance criteria: the job passes on the shipped scaffold; deliberately re-enabling the spellcheck dictionary download makes it fail; the Windows and macOS samplers see the positive control and report nothing else from the app.
- Verified by: the passing run and the deliberate-failure run.

### 2. Host implementations: save, lock, backups

- Does: the main-process implementation of the atomic save (write a temporary file, flush, rename over the target, flush the directory where the OS allows), the sidecar lock file with stale-lock detection, rotating backups in the app-data folder, and the on-disk change check (AD-12), all behind `HostApi` and `FileStore`, with the mock kept in step.
- Acceptance criteria: a simulated crash between write and rename leaves either the old or the new file, never a mix; a stale lock is detected after a process dies; integration tests cover each on real temporary folders on Windows and macOS.
- Verified by: the integration run in CI.

### 3. Menus and file drops

- Does: the macOS native menu (About, Settings, Quit and the Edit items, so Cmd+Q, Cmd+Z and Cmd+S work, H1.16), the hamburger menu elsewhere (H1.14), and CSV drag-and-drop import using the native drop event so the host receives real file paths.
- Acceptance criteria: menu commands reach the renderer through the host interface; dropping a CSV starts an import with the file's path on both OSes; the known conflict between native drops and in-page drag-and-drop is documented.
- Verified by: end-to-end tests where the platform allows, and a manual check on each OS where it does not.

### 4. The test layers

- Does: the domain scenario tests (import, query, close, reopen) on fixtures and temporary folders, run in plain Node; the Playwright harness growing from the smoke test: structured state reads, role and test-ID locators, per-OS screenshot baselines with a manual update workflow that opens a pull request; real key events for Tab order and dialog focus where the platform allows; and a test for the debugging guard's early-attach window (R5).
- Acceptance criteria: two consecutive runs on identical code match every screenshot within a stated tolerance on each OS; the guard test shows what an attach before the guard runs can and cannot do; the domain scenarios run with no display.
- Verified by: CI runs and the guard test result.

### 5. The read-only web check

- Does: a browser host for the renderer (`apps/web`, throwaway or kept) that reads a `.folio` fixture chosen with a file input, parses it locally with the core and shows the Transactions and Reporting pages. Playwright runs it in Chromium, Firefox and WebKit.
- Acceptance criteria: the pages render and the grid, charts and legend work in all three engines; nothing is uploaded (a request log shows none); the accessibility tree of the grid is dumped in each engine.
- Verified by: the Playwright run and the dumps; the result decides how much of the web build is "nearly free" (AD-17).

### 6. The household install experience

- Does: build the unsigned Windows installer and macOS disk image, write the one-page instructions for opening them (the SmartScreen and Gatekeeper steps), and test the install, first run, an upgrade over an existing install and an uninstall on clean machines or VMs.
- Acceptance criteria: a household member can follow the instructions without help; an upgrade keeps their settings and recent files.
- Verified by: a walkthrough on each OS.

## Requirements

- The capture job must fail loudly and be read: every Electron update pull request shows its output, including notices.
- Security and logging as in the app scaffold plan.

## Open questions

- Whether the Windows and macOS captures need a self-hosted or larger runner for reliable results. [Engineer, at milestone 1]
- Whether `apps/web` is kept as a real app or discarded after the check. [Jeremy, at milestone 5]
- Where unsigned-install instructions live (README, a docs page, or inside the app). [Jeremy, at milestone 6]
