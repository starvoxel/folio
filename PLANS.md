# Plans

The high-level list of what is planned or under way. One line each; the detail lives in the linked plan. An idea that is not being done now still gets a line, so it is not forgotten.

## In progress

None.

## Planned, in build order

Row order is the build order. "Needs" names what must be finished first; "Plan status" is the status field in the plan file. No plan is Approved yet, so each needs the Draft-to-Approved commit before work starts.

| #   | Item                                                                                                                       | Plan status | Needs                                                                                                                          | Plan                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | Electron foundations: privacy capture in CI, save, lock and backups, menus and file drops, test layers, web check, install | Approved    | Nothing outstanding. Milestone 2 (save, lock, backups) gates 3 and 4; milestone 3 (menus, drops) gates CSV import entry points | [plans/electron-foundations.md](plans/electron-foundations.md) |
| 2   | UI regression suite: end-to-end scenarios, per-OS screenshot baselines, Dependabot gating                                  | Draft       | Nothing outstanding for milestones 1, 2, 4 and 5. Milestone 3 needs setup and accounts milestones 2 and 3 and the CSV fixtures | [plans/regression-suite.md](plans/regression-suite.md)         |
| 3   | Setup and accounts (S): new file, accounts, category templates, setup dialog, Accounts page, the `.folio` format (AD-2)    | Approved    | Milestones 1 and 2: nothing. Milestone 3: Electron foundations milestone 2. Milestone 6 (last step): CSV import                | [plans/setup-and-accounts.md](plans/setup-and-accounts.md)     |
| 4   | CSV import (I): pipeline, provider profiles, preview, duplicates, flags, CSV fixtures                                      | Draft       | Milestones 1 to 4: setup milestones 1 and 2. Milestone 5 on: setup milestone 3 and Electron foundations milestones 2 and 3     | [plans/csv-import.md](plans/csv-import.md)                     |
| 5   | Categorization (C)                                                                                                         | None        | Not stated; set when planned                                                                                                   |                                                                |
| 6   | Transfers and savings (T)                                                                                                  | None        | Not stated; set when planned                                                                                                   |                                                                |
| 7   | Month-end review and locking (M)                                                                                           | None        | Not stated; set when planned                                                                                                   |                                                                |
| 8   | Reporting (A)                                                                                                              | None        | Not stated; set when planned                                                                                                   |                                                                |
| 9   | App shell and settings (H), including backups and undo                                                                     | None        | Not stated; set when planned                                                                                                   |                                                                |
| 10  | Net worth (N)                                                                                                              | None        | Rows 3 to 9 (ships after the core views)                                                                                       |                                                                |

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
