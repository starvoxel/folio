# Plans

The high-level list of what is planned or under way. One line each; the detail lives in the linked plan. An idea that is not being done now still gets a line, so it is not forgotten.

## In progress

- Diagnostic logging: errors with safe stack traces, a log file, uncaught-error logging, `FolioError` and per-field privacy are done; masked third-party messages and a developer-only unredacted switch are next; encrypted details (age) come last and are optional. [plans/logging.md](plans/logging.md)

## Planned

Foundations, in the order the risks suggest:

- Electron foundations: privacy capture in CI, save, lock and backups, menus and file drops, the test layers, a read-only web check, and the household install experience. [plans/electron-foundations.md](plans/electron-foundations.md)
- UI regression suite: end-to-end scenarios on Windows and macOS, per-OS screenshot baselines, and Dependabot gating. [plans/regression-suite.md](plans/regression-suite.md)

Product features, from the [product requirements](knowledge/product/month-end-review.md). None has a plan yet; each gets one before work starts.

- Core month-end views, in priority order: setup and accounts (S), CSV import (I), categorization (C), transfers and savings (T), month-end review and locking (M), reporting (A), app shell and settings (H, including backups and undo).
- Net worth (N), after the core views.

## Done

- App scaffold: workspace, `core`, `host-api` with a mock, renderer shell, hardened Electron app, four kinds of test, and CI. [plans/app-scaffold.md](plans/app-scaffold.md)
- Layout foundation: form-factor profiles and width classes, with the desktop profile. [plans/layout-foundation.md](plans/layout-foundation.md)

## Later

- Budget targets and goals per category (version 2).
- PDF statement import, reusing the import preview step.
- Bulk tagging across categories.
- Printable month summary and CSV export.
- Optional file password and encryption.
- Opt-in online merchant lookup, after research on which service, if any.
- Linux desktop, best effort after Windows and macOS.
- Read-only web app, after the desktop core; the web check in the Electron foundations plan decides how much of the renderer carries over.
- Server backend for the budget data instead of a local file: opt-in and household-controlled.
- Phone app, not required.
- Performance and stress testing, a separate initiative. [knowledge/research/performance-and-e2e-testing.md](knowledge/research/performance-and-e2e-testing.md)
- Logging: a Settings toggle for protected diagnostic details, in place of the `FOLIO_LOG_SEAL_KEY` variable.
- Logging: an in-app "open logs" or "copy diagnostics" command.

## Not planned

- Direct bank connections, more than one currency, and two people editing the same file at once.
