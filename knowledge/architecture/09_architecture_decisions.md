---
section: '09'
title: 'Architecture Decisions'
lifecycle: draft
tags: [decisions, adr]
key_files: []
---

> The architecture decisions agreed with Jeremy on 2026-11-05 and revised on 2026-11-12 for the Electron stack, each with its reason and what it costs. Numbering is stable; a superseded decision is marked, not deleted.

| ID                                                                            | Decision                                                      | Status                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------- |
| [AD-1](#ad-1-the-whole-file-lives-in-memory)                                  | The whole file lives in memory                                | Accepted                            |
| [AD-2](#ad-2-the-budget-file-is-a-zip-of-json-and-jsonl-parts)                | The budget file is a zip of JSON and JSONL parts              | Accepted                            |
| [AD-3](#ad-3-one-classification-entry-point-frozen-at-close)                  | One classification entry point, frozen at close               | Accepted                            |
| [AD-4](#ad-4-every-change-is-a-command-checked-by-one-lock-guard)             | Every change is a command, checked by one lock guard          | Accepted                            |
| [AD-5](#ad-5-undo-replays-month-tagged-change-sets)                           | Undo replays month-tagged change sets                         | Accepted                            |
| [AD-6](#ad-6-transactions-have-lines)                                         | Transactions have lines                                       | Accepted                            |
| [AD-7](#ad-7-money-dates-and-ids-have-their-own-types)                        | Money, dates and ids have their own types                     | Accepted                            |
| [AD-8](#ad-8-import-is-a-pipeline-of-pure-stages)                             | Import is a pipeline of pure stages                           | Accepted                            |
| [AD-9](#ad-9-rules-run-in-a-computed-order)                                   | Rules run in a computed order                                 | Accepted                            |
| [AD-10](#ad-10-an-audit-log-not-event-sourcing)                               | An audit log, not event sourcing                              | Accepted; details at implementation |
| [AD-11](#ad-11-settings-split-between-file-and-machine)                       | Settings split between file and machine                       | Accepted                            |
| [AD-12](#ad-12-backups-lock-file-and-on-disk-change-check)                    | Backups, lock file and on-disk change check                   | Accepted                            |
| [AD-13](#ad-13-charts-are-echarts-behind-chart-models)                        | Charts are ECharts behind chart models                        | Accepted                            |
| [AD-14](#ad-14-package-layout-ui-state-and-testing)                           | Package layout, UI state and testing                          | Accepted                            |
| [AD-15](#ad-15-the-design-system-is-fluent-ui-react-v9-behind-app-components) | The design system is Fluent UI React v9 behind app components | Accepted                            |
| [AD-16](#ad-16-testing-and-drivability-without-a-network-port)                | Testing and drivability without a network port                | Accepted                            |
| [AD-17](#ad-17-electron-with-typescript-is-the-stack)                         | Electron with TypeScript is the stack                         | Accepted                            |
| [AD-18](#ad-18-the-renderer-is-hardened-and-privacy-is-checked-in-ci)         | The renderer is hardened and privacy is checked in CI         | Accepted                            |
| [AD-19](#ad-19-the-platform-is-one-interface-hostapi-and-filestore)           | The platform is one interface: HostApi and FileStore          | Accepted                            |
| [AD-20](#ad-20-windows-and-macos-packaging-unsigned-no-auto-update)           | Windows and macOS packaging, unsigned, no auto-update         | Accepted                            |

## AD-1. The whole file lives in memory

_Context._ The PRD wants document behaviour: Save, Discard, an unsaved-changes indicator, autosave on an interval, and undo that survives saving (H1.6 to H1.7). Ten years of one household is roughly 30k transactions, a few MB.

_Decision._ Opening a file loads everything into an immutable in-memory model. Edits change the model; saving serializes all of it. File size and open time get a budget: two thresholds kept in one constants file, where crossing the first warns and crossing the second fails. They are measured against a synthetic heavy household (for example 10 years at 6,000 transactions a year with splits, rules, notes and audit entries). How and where that measurement runs belongs to the separate performance-testing initiative, which may not use the regular test setup. The same thresholds can drive an in-app warning later.

_Consequences._ No database session to keep consistent with the UI; Discard is "drop the model". Memory and open time grow with history, which the size and open-time budget watches.

## AD-2. The budget file is a zip of JSON and JSONL parts

_Context._ With AD-1, a database's strengths (querying while working, incremental writes, many writers) go unused. What matters is atomic saves, corruption detection, schema evolution, later encryption and attachments, and a format the household can inspect.

_Decision._ A budget file uses the `.folio` extension and is a zip container, like `.docx`:

- `manifest.json`: file-format version, app version, a checksum per part, and whether each part is JSON or JSONL.
- One part per area (accounts, transactions, rules, months, net worth, settings, audit log). Parts that are long lists of independent records, such as transactions and the audit log, may be JSONL (one record per line). JSONL allows streaming and readable diffs, and a damaged line loses one record, not the whole part. Small structured parts stay JSON.
- `summary.json`: what the start screen shows (H1.1) without loading the rest.

Save writes a complete new file beside the original, flushes it, then atomically replaces the original. Save goes through the host (AD-19), which owns file-system access. Format upgrades are one migration step per format version on the way in. Parts are read and written with `JSON.parse` and `JSON.stringify` (JSONL line by line) and zipped with fflate. Every part is validated against a schema (for example with zod) on the way in, because parsed JSON is untrusted input.

Filtering stays in memory: array methods over the model plus a few lookup indexes (by month, by account) that change sets keep up to date. An in-memory database was rejected because it would be a second copy of the data to keep in sync with every command, undo and redo.

_Consequences._ There is no native dependency. Encryption, when it comes, is AES-GCM over the file's bytes, and attachments (PDF import) become zip entries. We write migration code by hand, and the file cannot be queried ad hoc outside the app.

## AD-3. One classification entry point, frozen at close

_Context._ Many PRD requirements answer "how does this line count?" (T1.3 to T1.8, A1.7, A1.9, A1.12, I1.22, S1.14). If each view filters on its own, views will disagree, which is the untrustworthy-totals problem the product exists to fix.

_Decision._ A single classifier returns each line's treatment: `Income`, `Spending(category)`, `Savings`, `NeutralTransfer`, or `Excluded(reason)`. It asks each owning area a question, in a fixed order, without those areas knowing about each other:

1. Confirmed fraud? → `Excluded(fraud)` (FraudDetection)
2. The account's own line, and the account is excluded from analysis? → `Excluded(account)` (Accounts)
3. Confirmed transfer pair? → into an excluded account: savings or spending per that account's setting; otherwise `NeutralTransfer` (TransferPairing)
4. Transfer out with no tracked destination? → savings or spending as marked (TransferPairing; PRD T1.13)
5. Category under Income? → `Income` (Categories)
6. Otherwise → `Spending(category)`; refunds are negative spending

Closing a month stores every line's treatment plus the month's totals and net-worth values. Locked months are reported from stored data; open months are classified live.

_Consequences._ Every view agrees, because every view gets its numbers from the one classifier. Locked months are protected even against fixes to the classifier in later app versions, because their stored results no longer depend on code. Changing account flags or merging categories after a close needs no special handling. Every money feature touches the classifier. If its order grows past a handful of steps, revisit how it scales.

## AD-4. Every change is a command, checked by one lock guard

_Decision._ All mutations are command objects that produce a change set. Before a change set is applied, one lock guard computes the months it touches and refuses it if any is locked. Domain types also refuse edits to locked lines as a second check. This makes C1.12, H1.8, I1.11 and T1.11 one check rather than many.

_Consequences._ No code path may mutate the model except through a command; the UI, the importer and undo all use the same path.

## AD-5. Undo replays month-tagged change sets

_Context._ Undo must survive saving (H1.7), must never alter a locked month (H1.8), and close is not undoable (M1.14). Example to support: Jan, Feb and Mar are open; you work in Feb, close Jan, then work in Feb again. Undo must walk back through all of the Feb work.

_Decision._ Each undo entry is a change set whose parts are tagged with the month they belong to, or "global" for accounts, rules and categories. Undo applies the inverse of each part.

- Closing a month removes that month's parts from every entry and keeps the rest. Undo then walks back through other months' work as normal.
- A rule change is a global part (the rule definition) plus per-month parts (recategorizations). After January closes, undoing it reverts the rule and February's recategorizations; January keeps its frozen values.
- An import that covered January and February, undone after January closed, removes only February's rows. This relaxes I1.15's "one step" (recorded in the PRD).
- The one case that stops undo: a part that cannot be split by month, such as confirming a transfer pair between a January and a February line. Its entry is dropped and undo stops there with a message naming the locked month.
- Reopening a month does not bring back its removed parts. Reopen itself is not undoable.

_Consequences._ Undo is command-and-inverse, not whole-model snapshots. The same change sets drive dirty tracking, lookup indexes and the audit log.

## AD-6. Transactions have lines

_Decision._ A transaction is the bank's row: date, description, amount, account and source fingerprint. It has one or more lines, each with an amount, a category and how that category was set (rule id, manual or none). Lines always sum to the transaction amount. An unsplit transaction has one line; in the UI it is a normal row, and a split transaction is a row that expands. Categories, treatments and reporting work on lines only.

_Consequences._ Splits need no special handling in rules, classification or reporting (C1.13, A1.11).

## AD-7. Money, dates and ids have their own types

_Decision._

- `Money` is a branded `number` holding a whole count of cents. All arithmetic goes through checked helpers that throw when a result is not a safe integer, so precision is never silently lost. The range is about ±$90 trillion (2^53 cents), far beyond any household. `bigint` was rejected: it is slower, has no JSON form without a custom codec, and the extra range is not needed. A lint rule and review forbid floating-point arithmetic on money, and amounts are parsed from decimal strings into cents without going through a float.
- Transaction dates are a branded `LocalDate` string (`YYYY-MM-DD`); months are a branded `YearMonth` string (`YYYY-MM`). JavaScript's `Date` is not used in the domain, because of time-zone and daylight-saving pitfalls.
- Time comes from an injected `Clock`, so coverage and "current month" logic is testable.
- Every entity has a UUID id from `crypto.randomUUID()`, so copying from another file and merging never collide.

_What "branded" means._ TypeScript checks types only at compile time, and a plain `number` carries no meaning, so a count of cents, a dollar amount and a row index look identical to the compiler. A brand is a label that exists only at compile time, attached to an ordinary value: `type Cents = number & { readonly __brand: 'Cents' }`. At runtime a `Cents` is just a number and costs nothing extra, but the compiler treats it as a different type from `number` and from every other brand, so it refuses to pass a bare `number` where `Cents` is expected, or to add `Cents` to a `Dollars`. The only way to create one is through a function that checks its input (for example `cents(250)`, which rejects fractions and unsafe integers), so every `Money` in the program has been validated. The nearest idea in C# is a small `readonly struct Money`, except a brand has no runtime cost. `LocalDate`, `YearMonth` and ids are branded strings in the same way.

_Consequences._ If fractions of a cent are ever needed, only the `Money` helpers change. CSV amounts with more than two decimals need a defined rule at import (open; settled in the import plan).

## AD-8. Import is a pipeline of pure stages

_Decision._ Import runs these stages in order:

1. Read the CSV.
2. Detect the provider from the headers.
3. Map columns and the sign of amounts.
4. Drop pending rows.
5. Check that the account's provider matches the file's (I1.25).
6. Stage the rows: duplicates, locked-month rows, coverage gap, rules, suspicious flags, transfer suggestions.
7. Produce an `ImportDraft`.

The preview shows the draft; confirming applies it as one command and saves immediately (H1.6b). Provider profiles are data, and the built-in ones ship as bundled data files. Each imported row keeps a source fingerprint (file hash, row number, raw text) for duplicate detection and auditing.

_Consequences._ The preview is the real import run as a dry run, so they cannot disagree. Each stage is testable with CSV fixtures.

## AD-9. Rules run in a computed order

_Decision._ The engine builds its evaluation order in memory from the rules and the C1.7 precedence: more conditions first, then provider rules before shared rules, then manual priority for remaining ties only. Nobody maintains the ordered list. Patterns are regular expressions. JavaScript's built-in `RegExp` has no match timeout and can backtrack catastrophically, so user-written patterns run on a linear-time engine (RE2 compiled to WebAssembly) or in a time-limited worker, and the choice is made at implementation. Rule-impact previews (C1.8, C1.9) are the same engine run as a dry run over open months.

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

## AD-13. Charts are ECharts behind chart models

_Decision._ The four chart types (donut, stacked bar, column bars, diverging bars) are drawn with ECharts (Apache-2.0, SVG renderer). A chart model feeds each chart with series data, colours taken from the design tokens, and click events for drill-down (A1.6). Rendering is replaceable without touching the chart models.

- Every chart has a keyboard-reachable equivalent: legend rows are real buttons that open the matching transactions, and the same numbers appear in a table beside the chart.
- ECharts' own generated accessibility label read raw integer cents in the selection slice, so it stays off in favour of our own label.
- The build tree-shakes ECharts, so each component the charts use (title, legend, tooltip and so on) is registered explicitly.
- Money reaches ECharts as integer cents and is formatted from integers, never through a float.

_More chart types are available._ ECharts has about twenty built-in series types, including line, bar, pie and donut, scatter, heatmap, candlestick, radar, funnel, gauge, treemap, sunburst, sankey and calendar. The [example gallery](https://echarts.apache.org/examples/en/index.html) shows them all with their source, and the [feature overview](https://echarts.apache.org/en/feature.html) lists the types. The net worth history (N1.7) and category trends are natural line or area charts. Adding a type means adding a chart model and a legend or table equivalent, not changing the rest.

_Alternatives kept in reserve_ (all MIT or ISC): Recharts, visx, Chart.js, Observable Plot. ECharts releases slowly (one release in six months at the 2026-11-12 check), which the chart-model boundary makes tolerable.

## AD-14. Package layout, UI state and testing

_Decision._ The repository is a workspace of packages (the scaffold plan names the tooling): `core` (all domain logic, never imports Node, the DOM, React or Electron), `host-api` (the interfaces from AD-19 and a mock), `renderer` (React screens, chart models, app components), and the `desktop` app that holds the Electron main process. A read-only `web` app comes later. Layers inside `core` are folders (`domain`, `commands`, `persistence` and so on), not extra packages.

UI state lives in a core store that components read through `useSyncExternalStore`. Components stay thin: when logic needs more than a trivial test, it belongs in `core` or in a small pure module in the renderer, and is unit tested.

Tests come in four kinds, each runnable on its own. The most expensive resource a test touches decides its kind, not how much code it covers.

| Kind         | Rule                                                                                                                                                                                                                         | Where                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Unit         | One process, deterministic. No real file system, network, Electron or browser engine; time comes from the injected `Clock`. A simulated DOM is allowed for component tests; several real modules may work together in memory | `*.test.ts` next to the code, run by Vitest          |
| Integration  | One machine: real temporary folders, the real host adapter, a real browser engine for the renderer, loopback                                                                                                                 | `tests/integration/`, Vitest                         |
| Architecture | Structural rules of the codebase itself (fitness functions): package boundaries, where Fluent may appear, test placement and naming                                                                                          | `tests/architecture/`, dependency-cruiser and Vitest |
| End-to-end   | The packaged app on a real OS window, driven by Playwright (AD-16)                                                                                                                                                           | `tests/e2e/`, Playwright                             |

- _Techniques are not kinds._ Property-based tests (fast-check), snapshot tests and committed sample `.folio` files (format-compatibility checks) go in whichever kind their resources put them in, usually unit. Product rules such as "a locked month never changes" are ordinary unit or integration tests.
- _Why unit tests sit next to the code._ The ai-foundation JavaScript standard colocates tests. A test is easy to find, and moves or is deleted with the module it covers, and imports stay short. The cost is a rule that keeps test files out of builds and packages, and an architecture check that keeps them from importing the wrong things. The other kinds live under `tests/<kind>/` because they span packages or need a real environment. A mirrored `tests/unit/` tree is equally workable: it keeps every kind in one place, at the price of longer paths and two trees that can drift apart.
- _Enforcement._ dependency-cruiser rules check that `core` imports nothing from Node, the DOM, React or Electron; that the renderer never imports Electron or Node; that the main process never imports React; that Fluent UI is imported only under `renderer/src/ui/fluent/`; and that unit tests import neither Electron nor Playwright. An architecture test checks that each test file sits in the right place and that tests follow the three-level naming shape (`describe` the subject, `describe` the condition, `it` the expected result). The rest of the unit rule (no real file system or network) is a review check. CI runs architecture tests first because they are the cheapest.
- _Later options._ Tagging tests within a kind (slow, visual or quarantined) is left open and not set up. Performance and stress testing are a separate initiative; they may use this setup.

_Consequences._ One language across domain, UI, host and tests, which is what lets the same core run in the desktop app, a Node tool and a browser.

## AD-15. The design system is Fluent UI React v9 behind app components

_Context._ Fluent UI React v9 matches the prototype's look, is maintained by Microsoft (908 commits by 65 authors in the 12 months to November 2026) and ships the components the design needs. A design system still changes faster than a domain, and replaceable presentation is a quality goal.

_Decision._ Use `@fluentui/react-components` v9 with its light and dark themes and the brand ramp set around the prototype's accent (#0078D4), and contain it:

1. Screens use colours, spacing and type only through Fluent tokens, never hard-coded values (for example text-primary is `tokens.colorNeutralForeground1`, card-bg `tokens.colorNeutralBackground1` with a `tokens.colorNeutralStroke2` border, divider `tokens.colorNeutralStroke2`; the exact names are verified against the pinned version). App tokens exist only where the prototype adds its own, such as the status backgrounds.
2. One theme module sets the themes, the accent and the app tokens, and follows the system theme unless the user chose light or dark (H1.9).
3. Fluent components reach screens through app components under `renderer/src/ui/fluent/`: the shell, dialogs, banners, icons, tables and form controls. Screens import those, not Fluent.
4. No Fluent import appears outside `renderer/src/ui/fluent/`. An architecture test enforces this.
5. Charts read colours from the same tokens and redraw on theme change.

_Component mapping._ The prototype's controls map to Fluent UI React v9 components as follows.

| Prototype                                                       | Fluent UI React v9                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| NavigationView                                                  | `NavDrawer` with nav items and a footer item                                                         |
| Button (standard, accent)                                       | `Button`, `appearance="primary"` for the primary action                                              |
| ComboBox (month, filters, provider)                             | `Dropdown`, or `Combobox` where typing helps                                                         |
| TextBox (search, notes, forms)                                  | `Input`, `Textarea`                                                                                  |
| ToggleSwitch (Full pass, month-end analysis, auto-open)         | `Switch`                                                                                             |
| ToggleButton (tabs and segment choices)                         | `ToggleButton`, or `TabList` where it is a real tab                                                  |
| InfoBar (status banners, toasts, warnings)                      | `MessageBar`                                                                                         |
| Dialogs (new file, import, reopen confirmation)                 | `Dialog`                                                                                             |
| Cards, tiles                                                    | `Card`, or a container styled with card tokens                                                       |
| Tables                                                          | Fluent `Table` markup with TanStack Virtual (Transactions, Accounts, close balances, import preview) |
| Charts (donuts, money in vs out, category bars, net worth bars) | ECharts behind chart models (AD-13)                                                                  |

_Tables._ Fluent's `Table` supplies the markup and TanStack Virtual (MIT, founder-led) supplies row virtualization for the 10,000-row grids; sorting, selection and the side details panel are ours. Editing happens in side panels, not in cells. The grid exposes `grid`, `row`, `gridcell` and `columnheader` roles with `aria-rowcount`, `aria-rowindex`, `aria-selected` and `aria-sort`; the focusable element is the scroll container and arrow keys move row selection. That is not a fully compliant ARIA grid. Screen-reader polish is a later initiative, and until then rows have accessible names and every control has a stable `data-testid` for test tooling.

_Revisit when_ a design review prefers another system, or Fluent UI's maintenance changes. The change stays inside `renderer/src/ui/fluent/`.

## AD-16. Testing and drivability without a network port

_Context._ Agents and automated tests need to drive the running app and the domain logic, and check results, without clicking pixels. A loopback server inside the app was considered and rejected for v1: it would put a network listener in the shipped binary for little gain, because Chromium's debugging pipe covers the same ground.

_Decision._ Three layers, each usable on its own:

1. _The core without a window._ The core is plain TypeScript, so unit and integration tests (AD-14) run the real commands, lock guard and file format in a plain Node process on fixtures and temporary folders, with no display. That covers import, queries, close and reopen end to end at the domain level. A command-line tool over the core was considered and left out: Playwright covers the UI path and the tests cover the domain path, so a tool would add a package with little new coverage. It can be added if scripting a real `.folio` file by hand, batch operations or a headless service ever needs it, and it is not tied to mobile.
2. _The real app through Playwright._ Tests start the packaged release binary with `FOLIO_AUTOMATION=1`. That turns on a renderer hook, `window.__folio` (`getState`, `navigate`, `settled`), which returns structured page state as JSON, and the test process attaches through Chromium's `--remote-debugging-pipe`, relayed by the test process, so no network port exists. The exact release binary is tested, with no extra build and no changes to production code for the drive itself. A main-process guard refuses `--remote-debugging-port`, `--remote-debugging-pipe`, `--remote-allow-origins` and `--inspect*` unless `FOLIO_AUTOMATION=1`, and the Node inspect fuse stays off in release builds. Playwright locates controls by role, name and `data-testid`.
3. _Real-window smoke and checks per OS._ On Windows and macOS runners, an end-to-end suite visits every page, reads state, takes screenshots, and compares them with per-OS baselines (fonts and rendering differ by OS, so baselines are never shared). The network-capture job of AD-18 runs on every Electron update.

_Consequences._ The release binary contains no automation server. A user who sets `FOLIO_AUTOMATION=1` on their own machine can drive their own app, which is the point of H1.17. The guard runs after Chromium starts parsing flags, so a very early attach is not covered; this window was not tested. Keyboard behaviour that depends on real focus (Tab order, dialog focus) is checked with real key events where the platform allows; synthetic key events through a driver do not move focus the way a user does. A guarded loopback server can be added later, if agents need to inspect release builds remotely, as its own decision with its own threat checks: loopback binding, a per-session token, a `Host` check, rejection of any `Origin` header, no CORS headers, no static files and size limits.

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
- _Capture._ A CI job runs the built app in an isolated network namespace on a Linux runner (the most rigorous setup: `strace` on every network syscall and `tcpdump`, with a sink route so an attempt would be seen, a positive control, and the DNS-name analyzer) through launch, every page and five minutes idle, and fails on any non-loopback `connect()` or external DNS query other than the known notice. It runs on every Electron update. Windows and macOS captures use per-process socket sampling; the Windows capture for Electron is not yet done (the Phase 2 plan).
- _Dependencies._ Dependency install scripts are blocked unless allowlisted (npm 12's `allowScripts`), new releases wait a minimum age (`min-release-age`), CI installs from the lockfile and verifies signatures, third-party actions are pinned to commit SHAs, and a licence check enforces MIT-or-equivalent. The settings are in the scaffold plan.

_Consequences._ The Linux capture job exists even though Linux is not a shipped platform, because it is the strongest evidence available; it does not replace Windows and macOS checks. Electron updates can add request types, so the capture must stay in CI and someone must read its output.

## AD-19. The platform is one interface: HostApi and FileStore

_Context._ The renderer and the core must not depend on Electron, so a read-only web build, a mobile wrapper, a mock for tests and a server-backed store can all slot in.

_Decision._ The renderer reaches the operating system only through a `HostApi` defined in the `host-api` package: open and save dialogs, reading and writing file bytes, an atomic save, lock acquire and release with stale-lock detection, backups, app-data settings, native menu events, file-drop events, reveal in folder and quit. Electron implements it with a preload bridge and main-process handlers; the renderer sees only that interface. Budget storage sits behind a narrower `FileStore` (open, save, lock, back up) so the data source can change without touching the screens.

- _Desktop._ The main process does the file work: write a temporary file, flush, rename over the target (AD-12). A native file drop event supplies paths for CSV import. The core runs in the renderer (or a worker, decided at scaffold); file bytes pass over the bridge.
- _Web, later and read-only first._ A browser implementation reads a `.folio` file picked with a plain file input and parses it locally with no upload, so it works in every browser without the File System Access API. There is no save, no lock and no native menu there.
- _Server backend, later._ A household-hosted server is another `FileStore` implementation, opt-in and controlled by the household. It is not built and not designed in v1; the interface is the only preparation, and the data layer avoids assuming a local file where that costs nothing. When it arrives, H1.12 is reworded, the content security policy allows exactly that origin, and the AD-18 capture allowlists it.
- _Mobile, later._ A wrapper around the same renderer is possible. It is not evaluated.

_Consequences._ Every feature that touches the file system or the OS goes through the interface and has a mock. The Tauri slice showed a second host can be written in about a hundred lines of Rust plus a thin adapter, which is the check that the boundary holds.

## AD-20. Windows and macOS packaging, unsigned, no auto-update

_Decision._ v1 is for the household only, so installers are unsigned: a Windows installer (NSIS) and a macOS disk image. Windows SmartScreen will warn about an unknown publisher, and macOS Gatekeeper will need a right-click Open (or the quarantine attribute removed) on first run. Signing and notarization need a paid certificate and a developer account; they are revisited if Folio is ever shared beyond the household.

There is no auto-update (H1.12). Updates are installed by hand. An opt-in, user-triggered "check for updates" that fetches a static version file is the only update mechanism that fits the privacy rule, and it is not in v1. The packager and installer tooling are chosen in the scaffold plan; the selection slice used `@electron/packager` with `@electron/fuses`, and `electron-builder` for installers.

_Linux, later._ A `.deb` first, built with electron-builder's default install script (it chooses the sandbox mode and installs an AppArmor profile on Ubuntu 24.04 and later); a CI job that installs the package and launches it without `--no-sandbox`; an AppImage only as a secondary format, because it cannot carry the profile and silently runs without the Chromium sandbox on those systems. X11 and Wayland and real GPUs need testing then; the CI runners have neither.

_Consequences._ The household must be told how to open the unsigned installers. Every Electron update means a new build for each OS.
