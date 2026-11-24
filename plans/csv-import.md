# Plan: CSV import

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-21 |

## Goal

A household can drop one or more provider CSVs on Folio, check a preview of exactly what will be added, and import it as one step that can be undone, without any row reaching the file before the user confirms. This is area I of the [product requirements](../knowledge/product/month-end-review-import.md): the import pipeline of [AD-8](../knowledge/architecture/09_architecture_decisions.md#ad-8-import-is-a-pipeline-of-pure-stages), the six built-in provider profiles, the column mapping for an unknown file, duplicate and coverage checks, local suspicious-transaction flags, and the preview and Settings screens.

## Scope

- In: the CSV reader; provider profiles as data, with the six bundled ones; detection and the one-time column mapping; sign direction and amount parsing, including the rule for more than two decimals that AD-7 left open; the pipeline stages up to the `ImportDraft`; the transaction and known-balance records in the file; the import command and its undo parts; the preview, the import dialog and the profile list in Settings; the CSV fixtures; unit, integration and the end-to-end scenarios.
- Out: the rules engine and categories beyond a stage seam that calls them (the categorization plan, C); transfer pairing beyond a stage seam (the transfers plan, T); the review queue that suspicious flags continue into (M); the main-process file drop (Electron foundations, milestone 3); PDF import (Later); online merchant lookup (Later).

## Approach

Decisions are AD-8 (the pipeline), AD-6 (transactions have lines), AD-7 (money, dates), AD-4 and AD-5 (commands, month-tagged undo), AD-2 (the file, with `transactions` as a JSONL part), AD-10 (audit log, no financial data in diagnostics) and AD-11 (provider profiles live in the budget file; the six built-in ones ship as bundled data). Affected arc42 sections: 03, 04, 09.

1. _The pipeline is pure and staged._ Each stage is a function from the previous stage's output to its own, with no file system, clock or network: read, detect, map, drop pending, check provider (I1.25), stage, draft. The preview is the draft; confirming applies the same draft as one command, so the preview and the import cannot disagree.
2. _A provider profile is data._ A profile says how to recognise a file (header names, order, a date format, optional first-lines marker), how to read each field (date format, description column, amount or debit and credit columns, balance column), which sign means money out, and how to spot a pending row. The built-in six are JSON files in the repository, validated by the same schema as a user-made profile. Recognising a file is scored, not exact: all required headers present, extra columns allowed, and the best profile wins only if it beats the next by a margin; otherwise the user maps.
3. _Reading is strict about structure and kind about content._ Encoding (UTF-8 with or without a byte-order mark, then a Windows-1252 fallback), delimiter (comma, semicolon, tab), quoted fields with embedded commas and newlines, and a preamble before the header are handled. A file with no usable header, a row with the wrong column count, a date or amount that does not parse, or no rows, fails the whole file with a message naming the row and column, and adds nothing (I1.16). The message never quotes the cell.
4. _Amounts reach `Money` through the decimal parser that already exists_ (no float). More than two decimals: reject the file by default and name the row, because rounding silently would change totals. Decided: reject (see Decisions).
5. _The draft carries everything the preview shows:_ rows, each with its suggested category from the rules seam, duplicate flags, locked-month skips, suspicious flags with reasons, transfer suggestions, a coverage warning, and a summary of counts per month. Rows in locked months are listed and skipped; the rest still imports (I1.11). Pending rows are dropped before this (I1.9).
6. _Duplicates:_ same account, date, amount and normalised description as an existing transaction (the PRD's definition, so re-importing an identical file flags every row). Normalised means case-folded, whitespace collapsed, and a provider's known noise removed. Within one file, two identical rows are two transactions (a real double purchase), and only rows matching already-imported transactions are flagged. The user can keep or skip each flagged row.
7. _Suspicious flags are local and cheap._ Four checks (new merchant with a large amount, repeated charges in a short window, an amount far above the merchant's norm, foreign-currency or unusual-merchant-code markers) read only the file's existing transactions and the draft. They run in the staging step, produce a reason string each, never block and are measured so a slow check is a failing test. Thresholds are household settings with defaults (I1.24; AD-11 lists them in the file). Fraud marking itself is a command in this plan; excluding confirmed fraud from totals is the classifier's job (AD-3, first rule).
8. _Each imported row keeps a source fingerprint_ (file hash, row number, raw row text) for duplicate detection and audit (AD-8). The raw row can contain a merchant name and an amount, so it lives only in the file's `transactions` part and never in a log, an error or a test snapshot outside fixtures.
9. _Confirming is one command with month-tagged parts_ (AD-5), saved immediately (H1.6b) through the file session. Undo removes the rows in still-open months of the import (I1.15, as relaxed by AD-5).
10. _The renderer drives a state machine_ (choose, detect or map, account, preview, importing, done or failed) in a pure module with unit tests; the dialog only renders it. Files arrive from the file dialog, a drop event or an account's Import button (S1.21) as paths read through the host.

## Milestones

Depends on the [setup and accounts plan](setup-and-accounts.md), milestones 1 and 2 (the model, the command seam with the lock guard, and the `.folio` container with the `transactions` part registered). Milestones 1 to 4 here are pure and can run as soon as those two are done; milestone 5 onward writes real files and needs milestone 3 of that plan, and so, through it, [Electron foundations](electron-foundations.md) milestone 2. The drop and menu entry points need Electron foundations milestone 3.

### 1. Reader and profiles

- Does: the CSV reader (encoding, delimiter, quoting, preamble), the profile schema, the six bundled profiles, detection with scoring, the column-mapping model that turns a mapping into a saved profile (I1.4), and the amount and date parsers with the sign direction (I1.5). The CSV fixtures of this plan.
- Acceptance criteria: every fixture detects as its own provider and no other; an unmatched fixture asks for a mapping; a mapping round-trips into a profile that then detects the same file; every malformed fixture fails with the row and column and no content; amounts parse without a float and an amount with three decimals is rejected as decided.
- Verified by: the unit run over the fixtures.

### 2. Staging

- Does: pending-row removal, the provider check against the chosen account (I1.25), coverage and gap detection against an account's covered-through date (I1.12, I1.13), duplicates, locked-month skipping through the lock guard, the suspicious checks, the seams for rules (C) and transfers (T) with null implementations, and the `ImportDraft`.
- Acceptance criteria: a file that spans two months files each row under its own date (I1.10); a file for an account whose provider differs is refused and adds nothing; re-importing an identical file flags every row as a duplicate; a file starting after covered-through warns; a locked-month row is listed and skipped while the others import; each suspicious check has a case that trips it and a case that does not; staging a 5,000-row file against 30,000 existing transactions finishes within a stated time (proposed 1 second on a CI runner).
- Verified by: the unit run and one timed integration test.

### 3. The import command, the file records and undo

- Depends on: setup and accounts milestone 2 for the part schema; this plan defines the `transactions` and known-balance schemas and the setup plan's registry picks them up.
- Does: the transaction record (AD-6: lines, source fingerprint), the known-balance record (I1.17), the confirm command with its month-tagged parts, the undo inverse, the covered-through calculation and its update on import, the suspicious dismiss and confirmed-fraud commands (I1.22) with their note, and the audit entries.
- Acceptance criteria: confirming adds exactly the rows the preview showed; undo removes them all; undo after one of the months closed removes only the open months' rows; confirmed fraud carries a note and is recorded; a file round-trips with its transactions and byte-identical output (setup plan milestone 2).
- Verified by: unit and property tests (confirm then undo restores the model), and an integration test on a real temporary file.

### 4. The import dialog and the preview

- Does: the state machine, the import dialog (files, detected provider, account choice that suggests the last account used with that provider, I1.6), the preview table with every row, its suggested category, duplicate, suspicious and skipped-month marks, a clear summary of what will be added per month, and the failure and warning panels.
- Acceptance criteria: nothing is written until Import is pressed (a test checks the model is unchanged after every step before it); a wrong sign setting is visible in the preview before import (I1.5); every control has an accessible name and the preview is operable by keyboard; light and dark screenshots of each state.
- Verified by: component tests, the integration run with the mock host, the end-to-end scenario.

### 5. Entry points and the setup step

- Depends on: setup and accounts milestone 3 (real save and open); Electron foundations milestone 3 for drops.
- Does: the file dialog and the native drop route into the dialog (I1.1), several files in one go, immediate save after a confirmed import (H1.6b), the account detail's Import button (S1.21), and the last setup step of S1.8 using the same dialog.
- Acceptance criteria: dropping two CSVs opens one dialog with both; the file on disk contains the import after Import is pressed; setup's last step imports through the same code path as the normal dialog (no copy).
- Verified by: the end-to-end scenarios in the regression suite, milestone 3.

### 6. Provider profiles in Settings

- Does: the list of profiles with view, edit and delete (I1.18) and the suspicious-check thresholds with defaults and reset (I1.24).
- Acceptance criteria: a built-in profile can be viewed and copied but not deleted; a user profile that existing accounts use asks before deleting and leaves their transactions alone; a changed threshold changes the next preview and no earlier one.
- Verified by: component tests and an integration test.

### 7. Records and documents

- Does: AD-8 updated (the stages as built, the decimals rule), the design notes, the PRD assumptions closed where decided, arc42 `key_files`.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Fixtures

All data is invented; nothing from a household statement enters the repository. The fixtures live in `tests/fixtures/csv/` and are read by the unit, integration and end-to-end kinds, and by the performance initiative's import benchmark ([the research brief](../knowledge/research/performance-and-e2e-testing.md), item 5). The list is the one the [setup and accounts plan](setup-and-accounts.md) and [regression suite](regression-suite.md) milestone 3 depend on: six providers in their real layouts with 10 to 20 rows each; a two-month file; a file with pending rows; a file with a balance column; a file that starts after an account's covered-through date; an unmatched layout; a malformed file; a file whose rows duplicate another; plus a generated large file (5,000 rows) made by the seeded household generator and not committed.

## Requirements

- Privacy: files are read locally and never uploaded; no cell content in errors, logs, diagnostics or snapshots outside the invented fixtures; the suspicious checks make no request.
- Accessibility: the preview table and dialog work by keyboard, with accessible names and a text equivalent of every colour or icon mark (duplicate, suspicious, skipped).
- Security: a CSV is untrusted input: a size limit with a clear message, no formula evaluation, no path taken from the file, and a regular-expression-free reader.
- Reliability: a failure at any stage leaves the model and the file as they were.

## Risks

- Real exports differ from my idea of them (extra preamble lines, a trailing summary row, locale-specific dates), and the six profiles are only as good as the samples. Mitigation: the header-and-conventions samples from Jeremy (setup plan, decision 6), scored detection that tolerates extra columns, and a fix being a data file change.
- Duplicate detection by description will flag legitimate repeat charges, and miss a duplicate whose description a bank changed between exports. Mitigation: the preview lets the user keep or skip each; the rule is the PRD's and stays simple.
- Suspicious thresholds with no real data will be wrong at first. Mitigation: defaults are conservative, they are editable (I1.24), and every flag says why.

## Decisions

Answered by Jeremy, 2026-11-22:

1. An amount with more than two decimals rejects the file and names the row; nothing is rounded.
2. The suspicious checks use the proposed defaults, all changeable in Settings (I1.24): large means at least $500 and at least three times the account's median row; repeated means three charges with the same normalised description within 3 days; far above the norm means over three times that merchant's median with at least four earlier rows; foreign markers come from the provider's own currency or country columns where present. The first month is a calibration.
3. A profile made by mapping columns applies to later files with the same layout through normal detection; the preview still shows the provider and account before anything is added.
4. A CSV is limited to 20 MB and 50,000 rows, with a clear message.

## Open questions

1. Which encodings and delimiters must work on day one? [Engineer, at milestone 1] _Recommendation:_ UTF-8 (with or without a byte-order mark) and Windows-1252; comma and semicolon. Tab and others are added as a profile field if a real sample needs it.
2. Does the import wait for the rules and transfer plans, or ship with null seams? [Engineer, at milestone 2] _Recommendation:_ ship with the seams so import can be used and tested first; rows arrive uncategorized, and the categorization plan fills the stage.
