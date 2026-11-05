---
section: '09'
title: 'Architecture Decisions'
lifecycle: draft
tags: [decisions, adr]
key_files:
  - Directory.Packages.props
  - src/Folio.Desktop/UI/Fluent/AppStyles.axaml
---

> The architecture decisions agreed with Jeremy on 2026-11-05, each with its reason and what it costs. Numbering is stable; a superseded decision is marked, not deleted.

| ID                                                                | Decision                                             | Status                              |
| ----------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------- |
| [AD-1](#ad-1-the-whole-file-lives-in-memory)                      | The whole file lives in memory                       | Accepted                            |
| [AD-2](#ad-2-the-budget-file-is-a-zip-of-json-and-jsonl-parts)    | The budget file is a zip of JSON and JSONL parts     | Accepted                            |
| [AD-3](#ad-3-one-classification-entry-point-frozen-at-close)      | One classification entry point, frozen at close      | Accepted                            |
| [AD-4](#ad-4-every-change-is-a-command-checked-by-one-lock-guard) | Every change is a command, checked by one lock guard | Accepted                            |
| [AD-5](#ad-5-undo-replays-month-tagged-change-sets)               | Undo replays month-tagged change sets                | Accepted                            |
| [AD-6](#ad-6-transactions-have-lines)                             | Transactions have lines                              | Accepted                            |
| [AD-7](#ad-7-money-dates-and-ids-have-their-own-types)            | Money, dates and ids have their own types            | Accepted                            |
| [AD-8](#ad-8-import-is-a-pipeline-of-pure-stages)                 | Import is a pipeline of pure stages                  | Accepted                            |
| [AD-9](#ad-9-rules-run-in-a-computed-order)                       | Rules run in a computed order                        | Accepted                            |
| [AD-10](#ad-10-an-audit-log-not-event-sourcing)                   | An audit log, not event sourcing                     | Accepted; details at implementation |
| [AD-11](#ad-11-settings-split-between-file-and-machine)           | Settings split between file and machine              | Accepted                            |
| [AD-12](#ad-12-backups-lock-file-and-on-disk-change-check)        | Backups, lock file and on-disk change check          | Accepted                            |
| [AD-13](#ad-13-custom-charts-behind-chart-view-models)            | Custom charts behind chart view-models               | Accepted                            |
| [AD-14](#ad-14-solution-layout-and-mvvm-toolkit)                  | Solution layout and MVVM toolkit                     | Accepted                            |
| [AD-15](#ad-15-fluentavalonia-is-isolated-behind-app-wrappers)    | FluentAvalonia is isolated behind app wrappers       | Accepted                            |
| [AD-16](#ad-16-a-loopback-automation-server-and-cli)              | A loopback automation server and CLI                 | Accepted                            |

## AD-1. The whole file lives in memory

_Context._ The PRD wants document behaviour: Save, Discard, an unsaved-changes indicator, autosave on an interval, and undo that survives saving (H1.6 to H1.7). Ten years of one household is roughly 30k transactions, a few MB.

_Decision._ Opening a file loads everything into an immutable in-memory model. Edits change the model; saving serializes all of it. File size and open time get a budget: two thresholds kept in one constants file, where crossing the first warns and crossing the second fails. They are measured against a synthetic heavy household (for example 10 years at 6,000 transactions a year with splits, rules, notes and audit entries). How and where that measurement runs belongs to the separate performance-testing initiative, which may not use the regular test setup. The same thresholds can drive an in-app warning later.

_Consequences._ No database session to keep consistent with the UI; Discard is "drop the model". Memory and open time grow with history, which the size and open-time budget watches.

## AD-2. The budget file is a zip of JSON and JSONL parts

_Context._ With AD-1, a database's strengths (querying while working, incremental writes, many writers) go unused. What matters is atomic saves, corruption detection, schema evolution, later encryption and attachments, and a format the household can inspect.

_Decision._ A budget file uses the `.folio` extension and is a zip container, like `.docx`:

- `manifest.json`: file-format version, app version, a checksum per part, and whether each part is JSON or JSONL.
- One part per area (accounts, transactions, rules, months, net worth, settings, audit log). Parts that are long lists of independent records, such as transactions and the audit log, may be JSONL (one record per line) for streaming, readable diffs and damage containment; small structured parts stay JSON.
- `summary.json`: what the start screen shows (H1.1) without loading the rest.

Save writes a complete new file beside the original, flushes it, then atomically replaces the original. Format upgrades are one migration step per format version on the way in. Serialization uses System.Text.Json with source generation.

Filtering stays in memory: LINQ over the model plus a few lookup indexes (by month, by account) that change sets keep up to date. An in-memory database was rejected because it would be a second copy of the data to keep in sync with every command, undo and redo.

_Consequences._ No native dependency; encryption later is AES-GCM over the bytes; attachments (PDF import) become zip entries. We write migration code by hand, and there is no ad-hoc querying of the file outside the app.

## AD-3. One classification entry point, frozen at close

_Context._ "How does this line count?" is answered in many PRD places (T1.3 to T1.8, A1.7, A1.9, A1.12, I1.22, S1.14). If each view filters on its own, views will disagree, which is the untrustworthy-totals problem the product exists to fix.

_Decision._ A single classifier returns each line's treatment: `Income`, `Spending(category)`, `Savings`, `NeutralTransfer`, or `Excluded(reason)`. It asks each owning area a question, in a fixed order, without those areas knowing about each other:

1. Confirmed fraud? → `Excluded(fraud)` (FraudDetection)
2. The account's own line, and the account is excluded from analysis? → `Excluded(account)` (Accounts)
3. Confirmed transfer pair? → into an excluded account: savings or spending per that account's setting; otherwise `NeutralTransfer` (TransferPairing)
4. Transfer out with no tracked destination? → savings or spending as marked (TransferPairing; PRD T1.13)
5. Category under Income? → `Income` (Categories)
6. Otherwise → `Spending(category)`; refunds are negative spending

Closing a month stores every line's treatment plus the month's totals and net-worth values. Locked months are reported from stored data; open months are classified live.

_Consequences._ Every view agrees by construction. Locked months are protected even against fixes to the classifier in later app versions, because their stored results no longer depend on code. Changing account flags or merging categories after a close needs no special handling. The classifier is a hub every money feature touches; if its order grows past a handful of steps, revisit how it scales.

## AD-4. Every change is a command, checked by one lock guard

_Decision._ All mutations are command objects that produce a change set. Before a change set is applied, one lock guard computes the months it touches and refuses it if any is locked. Domain types also refuse edits to locked lines as a second line of defence. This makes C1.12, H1.8, I1.11 and T1.11 one check rather than many.

_Consequences._ No code path may mutate the model except through a command; the UI, the importer, undo and the automation server (AD-16) all use the same path.

## AD-5. Undo replays month-tagged change sets

_Context._ Undo must survive saving (H1.7), must never alter a locked month (H1.8), and close is not undoable (M1.14). Example to support: Jan, Feb and Mar are open; you work in Feb, close Jan, then work in Feb again. Undo must walk back through all of the Feb work.

_Decision._ Each undo entry is a change set whose parts are tagged with the month they belong to, or "global" for accounts, rules and categories. Undo applies the inverse of each part.

- Closing a month removes that month's parts from every entry and keeps the rest. Undo then walks back through other months' work as normal.
- A rule change is a global part (the rule definition) plus per-month parts (recategorizations). After January closes, undoing it reverts the rule and February's recategorizations; January stays as frozen.
- An import that covered January and February, undone after January closed, removes only February's rows. This relaxes I1.15's "one step" (recorded in the PRD).
- The one case that stops undo: a part that cannot be split by month, such as confirming a transfer pair between a January and a February line. Its entry is dropped and undo stops there with a message naming the locked month.
- Reopening a month does not bring back its removed parts. Reopen itself is not undoable.

_Consequences._ Undo is command-and-inverse, not whole-model snapshots. The same change sets drive dirty tracking, lookup indexes and the audit log.

## AD-6. Transactions have lines

_Decision._ A transaction is the bank's row: date, description, amount, account and source fingerprint. It has one or more lines, each with an amount, a category and how that category was set (rule id, manual or none). Lines always sum to the transaction amount. An unsplit transaction has one line; in the UI it is a normal row, and a split transaction is a row that expands. Categories, treatments and reporting work on lines only.

_Consequences._ Splits need no special handling in rules, classification or reporting (C1.13, A1.11).

## AD-7. Money, dates and ids have their own types

_Decision._

- `Money` wraps a `long` count of cents. Its operators use checked arithmetic, so overflow throws instead of wrapping. The range is about ±$92 quadrillion, far beyond any household. An unsigned magnitude with a separate sign was rejected: it gains one bit, loses native arithmetic and comparisons, and allows a negative zero.
- Transaction dates are `DateOnly`; months are a `YearMonth` value type.
- Time comes from `TimeProvider`, so coverage and "current month" logic is testable.
- Every entity has a GUID id, so copying from another file and merging never collide.

_Consequences._ If fractions of a cent are ever needed, only `Money`'s internals change. CSV amounts with more than two decimals need a defined rule at import (open; settled in the import plan).

## AD-8. Import is a pipeline of pure stages

_Decision._ Read CSV → detect provider by headers → map columns and sign → drop pending rows → check the account's provider matches (I1.25) → stage (duplicates, locked-month rows, coverage gap, rules, suspicious flags, transfer suggestions) → an `ImportDraft`. The preview shows the draft; confirming applies it as one command and saves immediately (H1.6b). Provider profiles are data, and the built-in ones ship as embedded resources. Each imported row keeps a source fingerprint (file hash, row number, raw text) for duplicate detection and auditing.

_Consequences._ The preview is the real import run as a dry run, so they cannot disagree. Each stage is testable with CSV fixtures.

## AD-9. Rules run in a computed order

_Decision._ The engine builds its evaluation order in memory from the rules and the C1.7 precedence: more conditions first, then provider rules before shared rules, then manual priority for remaining ties only. Nobody maintains the ordered list. Patterns are compiled .NET regular expressions with a match timeout. Rule-impact previews (C1.8, C1.9) are the same engine run as a dry run over open months.

To keep a large rule set manageable, the Rules screen groups rules by category and provider profile, has search, shows each rule's match count and last match, flags rules with no matches in 12 months, and detects shadowed rules (rules that can never win).

_Consequences._ Performance is not a concern at household scale (thousands of rules against thousands of rows is well under a second).

## AD-10. An audit log, not event sourcing

_Context._ Event sourcing stores every change as a permanent event and rebuilds state by replaying them. It costs permanent event-format compatibility, a file that only grows, replay code whose fixes can change rebuilt history (which threatens locked months), and much harder reasoning.

_Decision._ Store current state. Keep a permanent, append-only audit log in the file, written from each command's change set: when, which computer, the command and a summary, the months and entities touched, and before/after values for money-relevant fields (amount, category, treatment, balance). It is never replayed. Month history (M1.13) is a filtered view of it. Undo change sets stay in memory only.

_Open, settled at implementation:_ retention or compaction rules; exactly which fields are recorded. The audit log never feeds diagnostic logging, which must stay free of financial data.

## AD-11. Settings split between file and machine

_Decision._

| Stored in the budget file (household)                                                                                                                       | Stored on the machine (person)                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Provider profiles, transfer matching window, rolling average length, coverage tolerance, review and suspicious-transaction thresholds, online-lookup opt-in | Theme, autosave interval, auto-open last file, recent files, backup location |

The online-lookup opt-in lives in the file because it decides whether household data leaves the computer.

## AD-12. Backups, lock file and on-disk change check

_Decision._ Back up the file on open and on a rotating schedule, to the local app-data folder rather than beside the file, so a synced folder does not fill with copies (H1.10). A sidecar `.lock` file warns when another computer has the file open. Before saving, check whether the file changed on disk since it was loaded and warn instead of overwriting. Frequency and retention are set in the backup plan.

## AD-13. Custom charts behind chart view-models

_Decision._ The four chart types (donut, stacked bar, column bars, diverging bars) are custom-drawn Avalonia controls. Each is fed by a chart view-model that holds series data, colours taken from theme token keys, and click events for drill-down (A1.6). Rendering is replaceable without touching the view-models.

_Alternatives kept in reserve_ (all MIT, Avalonia 12): ScottPlot.Avalonia 5.1, OxyPlot.Avalonia 2.2; LiveCharts2 only as a prerelease. Avalonia Pro Charts is excluded (per-seat subscription and embedded licence checks).

## AD-14. Solution layout and MVVM toolkit

_Decision._ Projects follow the `csharp_avalonia` standard: `Folio.Core` (all domain logic, never references the UI), `Folio.Desktop` (views, view-models and thin adapters), and test projects grouped by kind (below). Layers inside Core are namespaces (`Folio.Core.Domain`, `Folio.Core.Commands`, `Folio.Core.Persistence`, …), not extra projects. Automation and CLI projects are added by AD-16.

Tests are grouped by what they check, and each kind runs on its own with `dotnet test tests/<Kind>.slnx`; `Folio.slnx` runs everything:

| Kind        | Checks                                                                                                                         | Today                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Unit        | Pure functions and domain logic, with no UI, file system or network                                                            | `tests/Unit/Folio.Core.UnitTests`                  |
| Integration | The app itself and how it meets UI and I/O: the real app on Avalonia's headless platform, bindings, file and platform adapters | `tests/Integration/Folio.Desktop.IntegrationTests` |
| Validation  | Structural constraints of the codebase: assembly references, where FluentAvalonia may appear, the test layout itself           | `tests/Validation/Folio.ValidationTests`           |

A test project lives under `tests/<Kind>/`, its name ends in `<Kind>Tests`, and it is listed in `tests/<Kind>.slnx` and `Folio.slnx`. `TestLayoutTests` in the validation project enforces this. View-model tests that need no UI are unit tests in a future `Folio.Desktop.UnitTests`.

Performance and end-to-end stress testing are a separate initiative, not further kinds of this setup. Whether they use this test setup at all is part of that investigation.

View-models use CommunityToolkit.Mvvm. DynamicData (with System.Reactive) is added only where views filter live: transaction search and filters, the account detail list and the rule-impact preview.

_Why CommunityToolkit over ReactiveUI._ It is Avalonia's template default and the docs call it the recommended framework. The project's hard logic is in Core, so view-models are thin and simple to test. Its API is small and stable, which suits agent-written code. ReactiveUI shipped three breaking major versions in 2026 (v24 to v26). ReactiveUI would win if most screens became stream-heavy; even then, wait for its API to settle.

_Consequences._ CommunityToolkit has one main maintainer; most of it is generated code over a frozen API, so it can be kept or replaced by a small base class if it stalls. The Core boundary is enforced by `tests/Validation/Folio.ValidationTests/Architecture/CoreDependencyTests.cs`.

## AD-15. FluentAvalonia is isolated behind app wrappers

_Context._ FluentAvalonia 3.1 is the only source of the shell controls the design needs (NavigationView, ContentDialog, InfoBar, the icon font) and matches the WinUI look most closely. It has one maintainer, inactive since August 2026, and open bugs (ContentDialog focus #766, NavigationView alignment). Avalonia 12.2's new Fluent2 theme is unreleased, shares the same WinUI token names, has none of those shell controls, and currently conflicts with FluentAvalonia's theme.

_Decision._ Build on FluentAvalonia 3.1 with Avalonia 12.1.5, and contain it:

1. Screens reference only WinUI token keys (`TextFillColor*`, `*FillColor*`, `*StrokeColor*`, `ControlCornerRadius`, `OverlayCornerRadius`) through `DynamicResource`, never FluentAvalonia-specific or `SystemControl*` keys.
2. One app-owned theme file sets the accent (#0078D4), font and app aliases such as `App.CardBrush`. Today that is `src/Folio.Desktop/UI/Fluent/AppStyles.axaml`.
3. FluentAvalonia controls are used only through wrappers: `AppShell` (NavigationView, with our own navigation-item model), `IDialogService` (ContentDialog, with multi-step logic in view-models), `AppBanner` (InfoBar) and `AppIcon` (symbol name → font glyph now, a path later).
4. No FluentAvalonia type or namespace appears outside `src/Folio.Desktop/UI/Fluent/`. Enforced by `tests/Validation/Folio.ValidationTests/Architecture/FluentIsolationTests.cs`.
5. Charts read colours from the same token keys and redraw on theme change.

_Revisit when_ Avalonia 12.2 ships. If FluentAvalonia supports it and offers a controls-only mode, use Fluent2 for the base theme and FluentAvalonia for its shell controls. If FluentAvalonia stays inactive and breaks, use Fluent2 plus our own shell controls, possibly forked from FluentAvalonia's MIT code. Either way the change stays inside `UI/Fluent/`.

_Tables._ The DataGrid (deprecated upstream, bug fixes only) is used where sorting or editing is needed, such as Transactions. Editing happens in side panels, not in cells, which avoids its in-cell focus bug (#248). Avalonia's TableView is used for small read-only tables; it has no column sorting.

## AD-16. A loopback automation server and CLI

_Context._ Agents and automated tests need to drive the running app and check results without clicking pixels.

_Decision._

- _Server._ When the app is started with `--automation`, a small HTTP server starts inside it, bound to `127.0.0.1` only, on a chosen or random port. Each session generates a random token, written to a file readable only by the current user; every request must carry it. Without the flag nothing listens. This keeps H1.12 intact.
- _Surface._ Commands (the same command objects as the UI, through the same lock guard), read-only queries (months, transactions, totals, checklist state), and view-model actions (navigate, read the current view-model state as JSON, invoke a view-model command, take a screenshot of the window). Changes go through commands, never around them.
- _CLI._ `Folio.Cli` builds a `folio` tool that finds a running app's port and token and calls the server, printing JSON for agents and readable text for people. Example verbs: `status`, `open`, `import`, `query`, `ui navigate`, `ui state`, `ui invoke`, `ui screenshot`.
- _Headless._ `--headless --automation` runs the real app on Avalonia's headless platform with Skia rendering, so CI and agents can drive the app and take screenshots with no display.
- _Projects._ The server lives in `Folio.Automation`, referenced by `Folio.Desktop`. It sits outside Core so the domain never depends on HTTP.

_Open, settled in its plan:_ HTTP stack (ASP.NET Core Kestrel minimal APIs versus the built-in `HttpListener`; Kestrel is the default choice for robustness, at the cost of the ASP.NET Core shared framework in the app); whether release builds include the server (proposed: included, but inert without the flag); the exact API shape and versioning.

_Consequences._ Agent validation, and end-to-end testing if that initiative chooses it, use the real app and the real command path. The server is a security surface, so it gets its own threat checks: loopback binding, token on every request, no static files, request size limits.
