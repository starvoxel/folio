---
section: '09.03'
title: 'Stack, privacy, logging and packaging'
lifecycle: draft
tags: [decisions, privacy, logging, electron]
key_files:
  - packages/renderer/src/app/automation.ts
  - tools/privacy-capture/src/strace-analyzer.ts
  - tools/privacy-capture/run-linux.sh
  - tests/e2e/support/linux-capture.ts
  - tests/e2e/support/socket-sampler.ts
  - apps/desktop/src/main/hardening.ts
  - apps/desktop/src/main/protocol.ts
  - apps/desktop/src/main/debug-guard.ts
  - apps/desktop/src/main/logger.ts
  - packages/core/src/support/folio-error.ts
  - apps/desktop/src/main/log-stack.ts
  - apps/desktop/src/main/log-message-mask.ts
  - apps/desktop/src/main/log-vocabulary.ts
  - apps/desktop/src/main/log-file.ts
  - apps/desktop/src/main/error-handlers.ts
  - apps/desktop/scripts/package.mjs
---

> Decisions AD-10, AD-16, AD-17, AD-18, AD-20. The list of all decisions is in [09_architecture_decisions.md](09_architecture_decisions.md).

## AD-10. An audit log, not event sourcing

_Context._ Event sourcing stores every change as a permanent event and rebuilds state by replaying them. It costs permanent event-format compatibility, a file that only grows, replay code whose fixes can change rebuilt history (which threatens locked months), and much harder reasoning.

_Decision._ Store current state. Keep a permanent, append-only audit log in the file, written from each command's change set: when, which computer, the command and a summary, the months and entities touched, and before/after values for money-relevant fields (amount, category, treatment, balance). It is never replayed. Month history (M1.13) is a filtered view of it. Undo change sets stay in memory only.

_Open, settled at implementation:_ retention or compaction rules; exactly which fields are recorded. The audit log never feeds diagnostic logging, which must stay free of financial data.

_Diagnostic logging._ The main process writes one JSON line per message to standard error and to `logs/folio.log` in the app's user-data folder in packaged builds (`logs-dev` in unpackaged runs; 1 MB, two rotated copies), which is never uploaded. Logged errors carry their class name, a system code such as `ENOENT` and their stack frames, never the message, because a message can quote data. Paths in frames keep their folders only below the app folder; every other path is cut to its file name, which removes the user's home folder and any folder a person named. The message of an error the app raises itself (`FolioError`, in `packages/core`) is written as it is, so it follows a message standard: fixed text plus ids, counts, dates, positions (row, column, offset) and hashes, never a value taken from a file, a field or a setting. Code that catches a third-party error wraps it in a `FolioError` and keeps the original as the cause. The message of any other error is masked before it is written, as `maskedMessage`: quoted text and any word outside a short reviewed list of error words become `<?>`, and a number survives only after a word such as `position` or `line`, so what the message can reveal is limited to that list. A log field marked `privateField` is written as `[private]`. Thrown values that are not errors are logged by type only. Uncaught exceptions and unhandled rejections are logged the same way, shown once in a fixed-text error box, and the app keeps running. Every log line carries an `id` made of a per-launch session id and a counter (such as `k7q2m9-0042`). A development-only switch (`FOLIO_LOG_UNREDACTED=1`, ignored in packaged builds) writes a second line with the same `id` for a message that has an error or a private field, holding only the raw message, raw stack, hidden words and private values. An unpackaged run shows it in the terminal and writes it to its own rotating file, `logs-dev/folio-unredacted.log`, on the developer's machine; the normal lines stay scrubbed and masked everywhere.

_Raw details, saved on purpose (approved, not yet built: logging milestone 7)._ The one exception to "no personal data in the clear" is a consented save. The raw message, raw stack and `privateField` values of logged errors are kept in an in-memory ring buffer (at most 200 entries or 1 MB, truncated strings, never an `Error` object, repeats collapsed to a count) that the app never writes to disk. The line `id` is written the same way in buffer entries, the saved file and the error boxes, so a log entry and a buffer entry are easy to connect. The buffer reaches a file only through a "Save diagnostic details…" command, where the person picks the location and the dialog says the file contains budget details; the error boxes offer it too, including before `app.exit` on a startup failure. The crash reporter stays off (AD-18); an operating-system crash dump of the app would contain the buffer, which the app cannot prevent. Details and limits are in [plans/logging.md](../../plans/logging.md).

## AD-16. Testing and drivability without a network port

_Context._ Agents and automated tests need to drive the running app and the domain logic, and check results, without clicking pixels. A loopback server inside the app was considered and rejected for v1: it would put a network listener in the shipped binary for little gain, because Chromium's debugging pipe covers the same ground.

_Decision._ Three layers, each usable on its own:

1. _The core without a window._ The core is plain TypeScript, so unit and integration tests (AD-14) run the real commands, lock guard and file format in a plain Node process on fixtures and temporary folders, with no display. That covers import, queries, close and reopen end to end at the domain level. A command-line tool over the core was considered and left out: Playwright covers the UI path and the tests cover the domain path, so a tool would add a package with little new coverage. It can be added if scripting a real `.folio` file by hand, batch operations or a headless service ever needs it, and it is not tied to mobile.
2. _The real app through Playwright._ Tests start the packaged release binary with `FOLIO_AUTOMATION=1`. That turns on a renderer hook, `window.__folio` (`getState`, `navigate`, `settled`), which returns structured page state as JSON, and the test process attaches through Chromium's `--remote-debugging-pipe`, relayed by the test process, so no network port exists. The exact release binary is tested, with no extra build and no changes to production code for the drive itself. A main-process guard refuses `--remote-debugging-port`, `--remote-debugging-pipe`, `--remote-allow-origins` and `--inspect*` unless `FOLIO_AUTOMATION=1`, and the Node inspect fuse stays off in release builds. Playwright locates controls by role, name and `data-testid`.
3. _Real-window smoke and checks per OS._ On Windows and macOS runners, an end-to-end suite visits every page, reads state, takes screenshots, and compares them with per-OS baselines (fonts and rendering differ by OS, so baselines are never shared). The network-capture job of AD-18 runs on every Electron update.

_Consequences._ The release binary contains no automation server. With automation on, `FOLIO_AUTOMATION_DIALOG_PATH` answers every file dialog, so end-to-end tests can reach the file operations; without automation it does nothing. In the same way, with automation on the main process answers two menu commands (click an item by its labels, describe the menu), which the macOS end-to-end test uses to check the native menu; without automation it registers no handler for them. A user who sets `FOLIO_AUTOMATION=1` on their own machine can drive their own app, which is the point of H1.17. The guard runs after Chromium starts parsing flags, so a very early attach is not covered; this window was not tested. Keyboard behaviour that depends on real focus (Tab order, dialog focus) is checked with real key events where the platform allows; synthetic key events through a driver do not move focus the way a user does. A guarded loopback server can be added later, if agents need to inspect release builds remotely, as its own decision with its own threat checks: loopback binding, a per-session token, a `Host` check, rejection of any `Origin` header, no CORS headers, no static files and size limits.

## AD-17. Electron with TypeScript is the stack

_Context._ Folio starts on Windows and macOS. A read-only web version is very much wanted later, a server-backed store and a phone view after that, and the developer is willing to learn a new language. Memory matters but does not decide. Window-free and real-window testing by agents matters. The selection spike built the same slice in Avalonia (C#), Electron with TypeScript and Tauri and measured all three against fixed gates (research: [stack-decision-comparison.md](../research/stack-decision-comparison.md) and [ui-framework-comparison.md](../research/ui-framework-comparison.md); the slices remain on the `spike/slice-*` branches as read-only reference).

_Decision._ Build the desktop app with Electron, React and TypeScript, with the domain core in plain TypeScript (AD-14, AD-19).

_Why._

- The same renderer and core can serve a read-only web build with real DOM, and a mobile wrapper later, as one codebase. Tauri's slice ran the same renderer with 12 lines changed out of 873, which shows the UI is shell-independent.
- Playwright drives the exact release binary on Windows and macOS (AD-16), and the core runs in Node for window-free testing.
- The ecosystem is deep and replaceable: Electron (OpenJS Foundation project), Fluent UI React (Microsoft), ECharts (Apache), and a very large pool of TypeScript and React knowledge and examples.
- Chromium is bundled and pinned, so rendering and screenshot baselines move only when Electron is updated.

_Alternatives rejected._

- _Avalonia (C#)._ Lighter (about half the memory on Windows and Linux, a package a third of the size) and it passed every gate. Rejected because its browser target draws on a canvas with partial accessibility and a large download, so an accessible web version would be a second UI; because its UI ecosystem is thin (the DataGrid is deprecated, FluentAvalonia has one dominant maintainer); and because its platform layers cannot expose table semantics from application code. A later web build would have meant two codebases.
- _Tauri._ Measured, not lighter in memory on Linux and macOS and a few percent on Windows once every web-view process is counted, with the Windows WebView2 runtime connecting out while idle, WebKitGTK's sandbox off on Linux, and three different browser engines to test. Its installers are much smaller, which is the only clear win. A later move to Tauri stays cheap because the renderer is shell-independent.

_Consequences._ About 160 MB (Windows, private working set) to 440 MB (Linux, proportional) of memory after scrolling a 10,000-row grid, against 87 to 224 MB for Avalonia, and installers of 100 to 126 MB. Electron ships a new major roughly every two months, so updates are monthly work (AD-18). Privacy needs ongoing checks, not a one-time review. Money and dates need discipline in TypeScript (AD-7).

_Revisit when_ the web version is dropped, footprint becomes a priority (small machines, many instances), the privacy-check burden proves too high, or Tauri's bundled-Chromium runtime reaches a stable release.

## AD-18. The renderer is hardened and privacy is checked in CI

_Context._ Nothing may leave the computer unless the household opts in (H1.12). Electron removes most of Chromium's background services but not all, and the selection spike found one default leak that a documented hardening set did not prevent: Chromium requested a spellcheck dictionary from Google's CDN.

_Decision._ Apply these from the first scaffold, and verify them with a capture:

- _Renderer._ Context isolation on, Node integration off, the Chromium sandbox on, a small preload bridge with schema-validated messages. The UI is served from a custom protocol with a per-load nonce and a strict content security policy (`default-src 'none'`, `script-src 'self'`, `connect-src 'none'`). No remote content. A deny-all request filter allows only the app protocol, devtools, `data:` and `blob:`. All permission requests, checks and device requests are denied. Navigation, redirects, new windows and `<webview>` are blocked, and external links open only on an explicit user action.
- _Process._ Never start the crash reporter. No auto-updater and no update check by default (AD-20). `--no-proxy-server` before the app is ready. Spellcheck is disabled and its language list set to empty; this is the only change that stopped the dictionary request, and the request escapes the deny-all filter. `GOOGLE_API_KEY` and its sibling variables are removed from the environment.
- _Fuses._ Run-as-Node off, Node options and Node CLI inspect arguments off in release builds, load-app-only-from-asar on, ASAR integrity on (worked on Windows in the spike; macOS untested), cookie encryption on, file-protocol privileges off.
- _Known notice._ Chromium runs an IPv6 reachability check (a UDP `connect()` to a public Google DNS address, port 443) before every host-name resolution, even for an IP literal. It sends no packet and no flag switches it off. It is absent while the app makes no request at all. When a feature makes requests (a server-backed store, an online lookup), it will appear and the capture allowlist must name it.
- _Capture._ A CI job runs the built app in an isolated network namespace on a Linux runner (the most rigorous setup: `strace` on every network syscall and `tcpdump`, with a sink route so an attempt would be seen, a positive control, and the DNS-name analyzer) through launch, every page and five minutes idle, and fails on any non-loopback `connect()` or external DNS query other than the known notice. It runs on every Electron update. Windows and macOS captures use per-process socket sampling; the Windows capture for Electron is not yet done (the Phase 2 plan). _Built (Electron foundations milestone 1)._ The scenario is `tests/e2e/privacy-capture.e2e.ts`, run by `npm run test:capture` and by the `privacy-capture` workflow whenever the Electron version, the lockfile, the hardening or the capture itself changes (a separate workflow, so no required check waits on a path filter). On Linux, `tools/privacy-capture/run-linux.sh` builds the namespace (a veth pair with a permanent neighbour entry, so attempts are emitted and a resolver address that never answers), and the scenario runs the app under `strace -f -e trace=network` with `tcpdump` recording. The positive control is a process that connects to a non-routable address and looks up a name that does not exist; the run fails if either is not seen. Windows and macOS sample the app's process tree once a second (`Get-NetTCPConnection`, `lsof`) and use a control process whose child connects to the runner's own non-loopback address (so the process-tree walk is proved too), because the app refuses every outside request and so cannot navigate to one. The analyzers are pure modules in `tools/privacy-capture/src` with unit tests. Each report lists what the capture cannot observe, and is written to the job summary for a person to read.
- _Dependencies._ Dependency install scripts are blocked unless allowlisted (npm 12's `allowScripts`), new releases wait a minimum age (`min-release-age`), CI installs from the lockfile and verifies signatures, third-party actions are pinned to commit SHAs, and a licence check enforces MIT-or-equivalent. The settings are in the scaffold plan.

_Consequences._ The Linux capture job exists even though Linux is not a shipped platform, because it is the strongest evidence available; it does not replace Windows and macOS checks. Electron updates can add request types, so the capture must stay in CI and someone must read its output.

## AD-20. Windows and macOS packaging, unsigned, no auto-update

_Decision._ v1 is for the household only, so installers are unsigned: a Windows installer (NSIS) and a macOS disk image. Windows SmartScreen will warn about an unknown publisher, and macOS Gatekeeper will need a right-click Open (or the quarantine attribute removed) on first run. Signing and notarization need a paid certificate and a developer account; they are revisited if Folio is ever shared beyond the household.

There is no auto-update (H1.12). Updates are installed by hand. An opt-in, user-triggered "check for updates" that fetches a static version file is the only update mechanism that fits the privacy rule, and it is not in v1. The scaffold uses `@electron/packager` with `@electron/fuses` to produce the one app folder that the tests drive and that the installers wrap (decided 2026-11-13). The installer tool (NSIS and disk image, where the slice used `electron-builder`) is chosen with the install-experience work in the [Electron foundations plan](../../plans/electron-foundations.md).

_Linux, later._ A `.deb` first, built with electron-builder's default install script (it chooses the sandbox mode and installs an AppArmor profile on Ubuntu 24.04 and later); a CI job that installs the package and launches it without `--no-sandbox`; an AppImage only as a secondary format, because it cannot carry the profile and silently runs without the Chromium sandbox on those systems. X11 and Wayland and real GPUs need testing then; the CI runners have neither.

_Consequences._ The household must be told how to open the unsigned installers. Every Electron update means a new build for each OS.
