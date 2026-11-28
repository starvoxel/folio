# Plans

The high-level list of what is planned or under way. One line each; the detail lives in the linked plan. An idea that is not being done now still gets a line, so it is not forgotten.

## In progress

- Electron foundations: milestones 1 to 3 done (privacy capture, save, lock and backups, menus and file drops); 4 to 6 not started. [plans/electron-foundations.md](plans/electron-foundations.md)
- Setup and accounts: milestones 1 and 2 done (budget model and commands, the `.folio` container); 3 to 8 not started. [plans/setup-and-accounts.md](plans/setup-and-accounts.md)

## Planned, in build order

Row order is the build order. "Needs" names what must be finished first; "Plan status" is the status field in the plan file. A plan still Draft needs its Draft-to-Approved commit before work starts.

| #   | Item                                                                                                                       | Plan status | Needs                                                                                                                          | Plan                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | Electron foundations: privacy capture in CI, save, lock and backups, menus and file drops, test layers, web check, install | Approved    | Milestones 1 to 3 done, so the save host and the menu and drops gates are met; 4 to 6 have nothing outstanding                 | [plans/electron-foundations.md](plans/electron-foundations.md)                 |
| 2   | UI regression suite: end-to-end scenarios, per-OS screenshot baselines, Dependabot gating                                  | Draft       | Nothing outstanding for milestones 1, 2, 4 and 5. Milestone 3 needs setup and accounts milestones 2 and 3 and the CSV fixtures | [plans/regression-suite.md](plans/regression-suite.md)                         |
| 3   | Setup and accounts (S): new file, accounts, category templates, setup dialog, Accounts page, the `.folio` format (AD-2)    | Approved    | Milestones 1 and 2: nothing. Milestone 3: Electron foundations milestone 2. Milestone 6 (last step): CSV import                | [plans/setup-and-accounts.md](plans/setup-and-accounts.md)                     |
| 4   | CSV import (I): pipeline, provider profiles, preview, duplicates, flags, CSV fixtures                                      | Draft       | Milestones 1 to 4: setup milestones 1 and 2. Milestone 5 on: setup milestone 3 and Electron foundations milestones 2 and 3     | [plans/csv-import.md](plans/csv-import.md)                                     |
| 5   | Categorization (C): rules engine, category and line commands, import seam, Transactions page, Rules & categories page      | Draft       | Setup milestones 1 and 2 and CSV import milestone 3 for 1 to 3; setup milestone 3 and CSV import milestone 6 for the pages     | [plans/categorization.md](plans/categorization.md)                             |
| 6   | Transfers and savings (T): the classifier, pair suggestion and commands, import matching, Transfers view                   | Draft       | Setup milestone 1, CSV import milestone 3, categorization milestone 2; milestone 5 needs setup milestone 3                     | [plans/transfers-and-savings.md](plans/transfers-and-savings.md)               |
| 7   | Month-end review and locking (M): month state and lock guard, checklist, close, reopen, review queue, Overview cards       | Draft       | Transfers milestones 1 and 3, categorization milestones 2 and 4, CSV import milestone 3, setup milestone 3                     | [plans/month-end-review-and-locking.md](plans/month-end-review-and-locking.md) |
| 8   | Reporting (A): reporting model, chart models, month breakdown, trend views, drill-down                                     | Draft       | Transfers milestone 1, month-end milestones 1 to 3 and 6, categorization milestone 4                                           | [plans/reporting.md](plans/reporting.md)                                       |
| 9   | App shell and settings (H), including backups and undo: undo and redo, save state, start screen, Settings page, backups    | Draft       | Setup milestone 3, month-end milestone 3                                                                                       | [plans/app-shell-and-settings.md](plans/app-shell-and-settings.md)             |
| 10  | Net worth (N): balances, free-form entries, close integration, Net worth page                                              | Draft       | Rows 3 to 9; month-end milestones 2 to 4 and 6, CSV import milestone 3, reporting milestone 2                                  | [plans/net-worth.md](plans/net-worth.md)                                       |

Rows 3 to 10 are the product features from the [product requirements](knowledge/product/month-end-review.md); C to H are listed in priority order. Rows 1 and 2 can run in parallel; row 2 only waits for 3 and 4 at its milestone 3.

Not blocking, pick up any time: diagnostic logging milestone 7, save diagnostic details (raw details kept in memory, saved only by the person). Approved 2026-11-24, not started; the plan has a start-here list. [plans/logging.md](plans/logging.md)

## Done

- Diagnostic logging, milestones 1 to 6: safe stack traces, a log file, uncaught errors, `FolioError` and private fields, masked third-party messages, line ids and the developer-only unredacted switch, plus `npm run dev` and a `.env` file. [plans/logging.md](plans/logging.md)
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
- Logging: age-sealed diagnostic details, per install, with a Settings toggle (an alternative to the in-memory buffer).
- Logging: boundary wrappers for third-party failures (`JSON.parse`, file reads, zip, schema) and a lint rule for `FolioError`.
- Logging: an "open logs folder" command and menu entries for "Save diagnostic details…", with the menu plan.

## Not planned

- Direct bank connections, more than one currency, and two people editing the same file at once.
