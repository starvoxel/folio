# Plan: Setup and accounts

| Field       | Value      |
| ----------- | ---------- |
| Status      | Approved   |
| Approved by | Jeremy     |
| Created     | 2026-11-21 |

## Goal

A household can create a budget file, add its accounts, pick a category template and open the result, and can later add, edit, archive and unarchive accounts and look at one account in detail. This is area S of the [product requirements](../knowledge/product/month-end-review-setup.md). It is also the first plan that needs a real budget file, so it builds the file format of [AD-2](../knowledge/architecture/09_02_file_and_host.md#ad-2-the-budget-file-is-a-zip-of-json-and-jsonl-parts) in `packages/core`, which every later feature saves into.

## Scope

- In: the budget model for accounts, categories and setup state; the minimal command and change-set seam of AD-4 that account and category edits need; the `.folio` container (manifest, parts, checksums, summary, migrations, typed failures) as pure bytes-in, bytes-out code in `core`; create, open and save of a file through `FileStore`; the two bundled category templates and Copy from an existing file; the setup dialog (name, accounts, categories, then the import step); the Accounts page and the account detail view; tests and the fixtures listed under "What the regression suite gets".
- Out: reading CSVs, provider profiles and the import preview (the [CSV import plan](csv-import.md); setup only launches that flow, S1.8); transactions, rules and months beyond the empty placeholders the format needs; the classifier (AD-3); undo and redo (H); autosave, the dirty indicator and the start screen (H); the main-process save, lock and backup code (the [Electron foundations plan](electron-foundations.md), milestone 2); net worth entries for assets and debts (S1.10, N); the file size and open-time budget (the performance initiative).

## Approach

Decisions are AD-1 (the file is a document held in memory), AD-2 (the container), AD-4 (commands and the lock guard), AD-7 (money, dates, ids), AD-11 (what lives in the file and what on the machine), AD-12 and AD-19 (backups, lock, `FileStore`). Affected arc42 sections: 03, 04, 09.

### What `packages/core` has today

Checked on 2026-11-21. It has the primitives and nothing of the budget itself:

| Present                                                                                                   | Where                          | Use here                                                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------- |
| `Money` (cents, checked arithmetic, decimal parsing), `LocalDate`, `YearMonth`, `Id<Tag>` with `IdSource` | `domain/`                      | Account balances, archive dates, ids of accounts and categories  |
| `Clock`, `systemClock`, `fixedClock`                                                                      | `domain/`                      | "Current month" at setup, `createdAt`; tests use the fixed clock |
| `Result`, `ok`, `err`, `ParseFailure`                                                                     | `support/result.ts`            | Codec and migration failures                                     |
| zod with `jitless`, `idSchema`, `moneySchema`, `localDateSchema`, `yearMonthSchema`, `parseWithSchema`    | `support/schema.ts`            | The part schemas of the format, which are untrusted input (AD-2) |
| `createStore`                                                                                             | `state/store.ts`               | The renderer's holder of the in-memory model                     |
| `readMachineSettings`                                                                                     | `settings/machine-settings.ts` | Machine settings only; file settings are new                     |

Not present, and needed: any budget entity (account, category, month, settings in the file), a command or change-set type, the lock guard, the container codec, a zip library (`fflate` is named in AD-2 and the arc42 stack table but is not in `package.json`; `zod` is the only dependency), a hash, and any fixture or `.folio` file in the repository. `tsconfig.base.json` has `lib: ES2023` and `types: []`, so `crypto.subtle`, `TextEncoder` and the DOM are not typed in `core`; that decides the digest question below.

`packages/host-api` already has `FileStore` (`open`, `save` with an expected `FileStamp`, `lock`, `unlock`, `backUp`) and a mock host. This plan uses them as they are.

### Design

1. _The format is pure._ `core/src/file/` turns a model into bytes and bytes into a model, with no file system. A file is a zip of `manifest.json`, `summary.json` and one part per area. Version 1 has these parts: `accounts`, `categories`, `settings` (the household settings of AD-11, plus setup state), `transactions` (JSONL), `rules`, `months`, `networth` and `audit` (JSONL). The last five belong to later plans. Here each is registered with a name, a kind (JSON or JSONL) and a placeholder schema for an empty part, so a file created by this plan opens in the app that later fills those parts. The owning plan replaces the placeholder schema when it lands.
2. _One registry drives everything._ A part registry (name, kind, schema, `empty()`, migrations) is the only place that knows the parts. Encode, decode, the manifest checksums and the fixtures all iterate it, so a later plan adds a part in one place.
3. _Decoding never trusts input and never throws._ It returns a `Result` with a failure code: `notAZip`, `manifestMissing`, `manifestInvalid`, `partMissing`, `checksumMismatch`, `schemaInvalid`, `lineDamaged` (JSONL: report the line number, keep the rest, as AD-2 promises), `newerFormat` and `migrationFailed`. Failure details name the part and line, never a value (no financial data in diagnostics, AD-10). The host maps these to the error and Open a backup offer of H1.11.
4. _Output is deterministic._ Fixed zip timestamps, entries in registry order, stable key order in JSON. The same model gives the same bytes, so fixtures can be compared and regenerated without noise, and the regression suite can assert on a file byte for byte.
5. _Checksums go through an injected `Digest`._ `core` cannot reach `crypto.subtle` under its current typings and must stay free of Node and the DOM. Like `Clock` and `IdSource`, the caller passes the digest (the host passes `crypto.subtle`, tests pass Node's), so no hash is written by hand. This is the recommendation under Open questions.
6. _Format migration is a chain of one step per version_ on the way in, tested from a committed golden file of each released version. Version 1 stays a draft until the core views (S, I, C, T, M, A, H) have shipped (Jeremy, 2026-11-22); until then the chain is empty and fixtures are regenerated, not migrated. A household file made before the freeze may need to be recreated, which is accepted.
7. _Edits are commands._ Account and category edits (`addAccount`, `updateAccount`, `archiveAccount`, `unarchiveAccount`, `deleteAccount`, `renameCategory`, `addCategory`, `removeCategory`, `applyTemplate`) are command objects that return a change set. A minimal `applyCommand` runs the lock guard of AD-4, which here only needs to know the locked months (none exist yet) so that its interface is fixed before month locking arrives. Undo (H) and the audit log (AD-10) consume the same change sets later; this plan produces them and tags each part `global` or with a month (AD-5).
8. _Account rules are pure functions on the model._ Defaults by type (S1.4), "can this type change" (before the first import only), "can this be deleted" (no transactions, S1.13) and `isIncludedInMonth(account, month)` (S1.14, S1.15). The last needs the account's activity periods rather than a single archived flag, so an account that was archived mid-month, then restored, is handled by a stored list of `archivedFrom` and `unarchivedOn` dates, not guessed.
9. _The renderer holds the model in `createStore`_ and goes through a `FileSession` (create, open, save, close) that wraps `FileStore`, the codec and the lock. Screens never see bytes.

### Account type defaults (S1.3, S1.4)

| Type             | In month-end analysis | Money moved into it counts as |
| ---------------- | --------------------- | ----------------------------- |
| Chequing         | included              | not applicable                |
| Savings          | included              | not applicable                |
| Credit card      | included              | not applicable                |
| RRSP, TFSA, RESP | excluded              | savings                       |
| Other investment | excluded              | savings                       |
| Mortgage         | excluded              | spending (housing)            |
| Other or custom  | asked at add time     | asked at add time             |

The transfer treatment for included accounts is the business of area T; setup stores the field and offers it only when the account is excluded.

## Milestones

Dependencies are named on each milestone. Milestones 1 and 2 need nothing outside `core`.

### 1. The budget model and the command seam

- Does: `Account`, `AccountType`, `Category` (two levels, a fixed Income root that cannot be removed), the file-level `HouseholdSettings` with `setup` state, the `BudgetModel` that holds them, the command and change-set types, `applyCommand` with the lock guard, the account rules of the design above, and `isIncludedInMonth`.
- Acceptance criteria: unit tests cover each type default (S1.4), the change-type-before-import rule, delete versus archive (S1.13), Income being unremovable and renamable (S1.7), and `isIncludedInMonth` for an account archived mid-month, archived across a whole month, and unarchived later (S1.14, S1.15), using the fixed clock; fast-check properties show that applying a command and its change set's inverse restores the model; `core` imports nothing from Node, the DOM, React or Electron (architecture check).
- Verified by: the unit and architecture runs.

### 2. The `.folio` container

- Depends on: milestone 1 for the model; adds `fflate` to `core` (exact version, 7-day release age, licence check).
- Does: the part registry, the codec (`encodeFolio`, `decodeFolio`), the manifest and checksums with the injected `Digest`, JSONL reading with per-line failure, `summary.json` built from the model (file name, open month, account count, last closed month; the rest of the start screen's fields arrive with their plans), deterministic output, the migration runner with an empty chain, and the failure codes above. AD-2 is updated with the part names and the checksum decision.
- Acceptance criteria: a model survives encode then decode unchanged (property test over generated models); the same model encodes to identical bytes twice; each failure code is produced by a purpose-built input (a flipped byte, a truncated zip, a missing part, a damaged JSONL line, a manifest claiming a newer version) and none of them throws or names a value; a damaged JSONL line loses one record and reports its line; a file of version N+1 is refused with `newerFormat` and not opened.
- Verified by: the unit run; a 2,000-account, 30,000-transaction synthetic model is encoded and decoded once in an integration test to show the codec is not accidentally quadratic (the real size and open-time budget stays with the performance initiative).

### 3. Create, open and save through the file store

- Depends on: [Electron foundations](electron-foundations.md), milestone 2 (atomic save, sidecar lock with stale-lock detection, rotating backups, the on-disk change check). Everything before this milestone is written against the host mock; this milestone is where the real host is needed. It can start as soon as milestone 2 of that plan has its acceptance criteria met, and it fixes the shape of `FileSession` for the first time against the real thing.
- Does: `FileSession` with `create(name)`, `open(ref)`, `save()` and `close()`. Create builds an empty model, encodes it and saves it to a location chosen with the save dialog, so the file exists on disk, is locked and can be backed up before the first edit (S1.1). Open takes the lock, reads, decodes, makes the backup of AD-12, and maps every decode failure to a user message and, for corruption, the offer to open the most recent backup (H1.11). Save passes the stamp from the last read, and a `changedOnDisk` result becomes the warning of AD-12 rather than an overwrite.
- Acceptance criteria: a created file opens at once with no accounts and the current month; a file with a flipped byte shows the corrupt-file error and offers the backup; a second open of a locked file shows the in-use warning; saving a file that changed on disk is refused with the warning; integration tests run each case on real temporary folders on Windows and macOS.
- Verified by: the integration run in CI.

### 4. Category templates and Copy from an existing file

- Does: the templates Detailed household and Simple as bundled data, and the toggle-and-edit screen that follows choosing one (each category on or off, renamed, added, removed; Income stays on) validated by the category schema (contents are in Decisions); `applyTemplate`; Copy from an existing file, which opens a second file read-only through the same codec and copies its categories. Rules, including provider rules, are copied by the same command once the rules part has a real schema (area C); until then the option copies categories only and says so.
- Acceptance criteria: both templates include Income and a Fees & interest category with Interest charges and Bank fees (C1.15); every template validates; copying from a file never takes its transactions, accounts or months; copying from a corrupt or newer-format file reports the failure and changes nothing; renaming, adding and removing at both levels after applying a template works, and Income cannot be removed.
- Verified by: unit tests and one integration test that copies between two real files.

### 5. Account management

- Does: the commands of milestone 1 wired to the file session; starting balance handling (S1.5); the account detail data: current balance, covered-through date, type, provider and analysis setting (S1.17), and the latest-known-balance rule (S1.18). The balance function reads the transactions part and known-balance records through a narrow interface that the CSV import plan fills, so this milestone ships with "no balance known, enter one" as the only reachable case in the app until import lands and is tested against a hand-built transactions list.
- Acceptance criteria: an account with transactions cannot be deleted, only archived; an archived account disappears from the picker list and from `isIncludedInMonth` for every month it was archived in; unarchiving does not change anything in a locked month (test with a locked-month stub); changing the analysis flag or transfer treatment leaves a stored month's frozen results unchanged (test with a stub month).
- Verified by: unit tests.

### 6. The setup dialog

- Depends on: the [CSV import plan](csv-import.md) for the last step (S1.8). Until the import flow exists, the step is shown disabled with an explanation and Finish is available (S1.11).
- Does: the dialog launched from the start screen: name (default "Household" plus next year, per the design notes), accounts (name, type, provider, starting balance, a running list), categories (template cards; after a template is chosen, a review screen where every category can be toggled on or off, renamed, added or removed, because the template is only a starting set), then the import step. The dialog can be closed at any step and the file opens with what was entered; unfinished steps are reachable from their normal screens and recorded in `setup` state. All text and controls follow the design notes and the design system boundary (AD-15).
- Acceptance criteria: each step works with the keyboard alone and every control has an accessible name; focus is inside the dialog on open and Escape closes it (with the unsaved setup kept in the file); leaving setup after step 2 opens a valid file; a screenshot of each step in light and dark.
- Verified by: component tests, the integration run with the mock host, and the end-to-end scenario from the regression suite.

### 7. Accounts page and account detail

- Does: the Accounts page with rows that open the detail view (S1.16), the collapsed Archived list (S1.14), the detail view with balance, covered-through, settings and the transaction list filtered by month, category and status (S1.19, over whatever transactions exist), archived accounts read-only except unarchive (S1.22), and the two "should" hooks: Review scoped to an account (S1.20) and Import with the account preselected (S1.21), wired as soon as the screens they open exist.
- Acceptance criteria: every row is a real link or button with an accessible name; the archived account's detail view offers only Unarchive; the transaction filters combine; a file with no transactions shows an empty state that says why.
- Verified by: component tests and the end-to-end scenario.

### 8. Records and documents

- Does: AD-2 updated (parts, checksum, determinism), a new decision record for the command seam if it is settled here, the design notes, the arc42 `key_files`, the README where it lists files.
- Acceptance criteria: all checks and test kinds pass; the architecture index is no longer stale for the sections touched.
- Verified by: CI.

## What the regression suite gets

[Regression suite](regression-suite.md) milestone 3 (file and import scenarios) says it "needs the file format (AD-2) and the CSV fixtures". Nothing for either exists yet. This plan supplies the following, and the milestone cannot start its file scenarios before milestones 2 and 3 here, nor its import scenario before the CSV import plan's fixture milestone.

File-format pieces, from this plan:

1. The real create and open path, so a scenario can create a file through the app and not only open a prepared one. It needs the host's automation route to supply a save path without the native dialog (AD-16's `FOLIO_AUTOMATION` hook); this plan names the need, and the Electron foundations plan (milestones 3 and 4) owns the route.
2. `buildFolioFile` in a shared test support module (`tests/support/`), a deterministic writer over the real codec and a model builder with a seeded `IdSource` and a fixed clock. It is the one way fixtures are made, so they cannot drift from the format.
3. A fixture script (`npm run fixtures`) that writes these files to a git-ignored folder, so the suite uses current-format files and never a stale binary:
   - `new-empty.folio`: what Create produces.
   - `household-small.folio`: three accounts (chequing, credit card, TFSA), the Simple template, current month only.
   - `household-archived.folio`: one account archived mid-month and one unarchived, for S1.12 to S1.15.
   - `setup-unfinished.folio`: left after step 2 (S1.11).
   - Damaged variants for H1.11: `corrupt-checksum.folio`, `corrupt-truncated.folio`, `corrupt-jsonl-line.folio`, `newer-format.folio`, and a plain text file named `.folio`.
4. A committed golden file per released format version (none until Version 1 is frozen, after the core views ship), loaded by a migration test, so an upgrade of the format cannot silently break old files. These are the only binary `.folio` files in the repository.
5. The state hook (`window.__folio`) shows file status: path, dirty flag, account list with archived and covered-through, setup state, and the last open error code. Test IDs follow the existing convention for the setup dialog steps, the Accounts rows and the error dialog.
6. A scenario list for the suite, one file each (the suite's rule): create a file; open `household-small`; each damaged variant shows the error and the backup offer; a second instance sees the in-use warning; archive and unarchive an account.

CSV fixtures. Authoring them belongs to the CSV import plan, because only import knows what each stage must be tested with. Setup needs, for its last step and for the regression suite's import scenario, at least:

- One small file per built-in provider (RBC, TD, Tangerine, EQ Bank, Questrade, CTFS), 10 to 20 invented rows each, in the provider's real export layout with a header line.
- One file whose rows fall in two months (I1.10), one with pending rows (I1.9), one with a balance column (I1.17), and one whose first date is after an account's covered-through date (I1.13).
- One unmatched layout (I1.4), one malformed file (I1.16), and one file whose rows duplicate another fixture (I1.8).
- All data invented: no real merchant, amount or account number from a household statement. The only real-world input is each provider's header line and date and sign conventions, which is why Jeremy is supplying them (decision 6).

## Requirements

- Accessibility: every control in the dialog and the Accounts page has an accessible name; the dialog traps focus and Escape closes it.
- Privacy: nothing in the format code or in the error messages names a merchant, amount or account name; failure details give a part and a line. A budget file stays local; the setup flow makes no request.
- Security: part data is validated with a schema on every read (AD-2); `fflate` is pinned exactly and passes the licence check; no `eval` (zod stays in `jitless` mode, AD-18).
- Logging: as in the app scaffold plan; decode failures are logged by code only.

## Risks

- The format is designed here but most of its parts belong to later plans. A part schema that changes after the household uses a file is a migration. Mitigation: the format stays version 1 and unfrozen until the core views have shipped (Jeremy, 2026-11-22), so a file a household creates earlier may have to be recreated, and each part's owning plan reviews its schema before the freeze.
- Undo and the audit log (H, AD-10) have not been planned. The change-set shape chosen here is the thing they inherit. Mitigation: keep it to the AD-5 tagging and review it with whoever plans H before milestone 1 is merged.
- `fflate` in `core` adds the first runtime dependency beyond `zod`. It is pure JavaScript with no Node dependency, so the boundary rules hold, but the architecture check must be run to confirm.

## Decisions

Answered by Jeremy, 2026-11-22:

1. Templates: Simple and Detailed household as drafted (Simple: Income with Pay and Other income, Housing, Food with Groceries and Restaurants, Transport, Health, Fun and gifts, Fees & interest with Interest charges and Bank fees, Other; Detailed adds subcategories under each, plus Children and Pets). After picking a template, setup shows a screen where any category can be toggled on or off or edited, since the template is only a starting set. The exact lists are written in the milestone 4 pull request.
2. Format version 1 is frozen after the core views ship, not at the first household install. Until then fixtures are regenerated, nothing is migrated and no golden file is committed.
3. Create asks for a save location at once, so the file exists, is locked and backed up before any edit.
4. The starting balance is entered as an amount only and dated when the first import is confirmed (the day before the earliest row). It can be skipped. Credit card and mortgage balances are labelled "Amount owed", typed positive and stored negative.
5. Copy from an existing file copies categories only for now, says rules are not copied yet, and gains rules, including provider rules, in the categorization plan.
6. Jeremy will supply the six providers' CSV header lines and date and sign conventions with invented rows, for the CSV import plan's fixture folder.

## Open questions

1. Where does the minimal command and change-set seam live, and does S build it? [Engineer, at milestone 1] _Recommendation:_ yes, in `core/src/commands/`, with only what S needs (the AD-5 tags, the lock guard, the inverse). A separate plan for it would block S on code with one consumer; undo and audit extend it when they are planned.
2. Does the digest for manifest checksums go through an injected interface? [Engineer, at milestone 2] _Recommendation:_ yes, SHA-256 behind a `Digest` the caller passes, as with `Clock` and `IdSource`. The alternative, a hand-written hash in `core`, is crypto code we would have to maintain; the alternative of typing the DOM or Node into `core` breaks its boundary.
