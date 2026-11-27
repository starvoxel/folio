---
section: '09.01'
title: 'Domain model and rules'
lifecycle: draft
tags: [decisions, domain]
key_files:
  - packages/core/src/domain/money.ts
  - packages/core/src/domain/clock.ts
  - packages/core/src/commands/apply-command.ts
  - packages/core/src/commands/command.ts
  - packages/core/src/commands/change-set.ts
  - packages/core/src/commands/lock-guard.ts
  - packages/core/src/budget/account-rules.ts
---

> Decisions AD-1, AD-3, AD-4, AD-5, AD-6, AD-7, AD-8, AD-9. The list of all decisions is in [09_architecture_decisions.md](09_architecture_decisions.md).

## AD-1. The whole file lives in memory

_Context._ The PRD wants document behaviour: Save, Discard, an unsaved-changes indicator, autosave on an interval, and undo that survives saving (H1.6 to H1.7). Ten years of one household is roughly 30k transactions, a few MB.

_Decision._ Opening a file loads everything into an immutable in-memory model. Edits change the model; saving serializes all of it. File size and open time get a budget: two thresholds kept in one constants file, where crossing the first warns and crossing the second fails. They are measured against a synthetic heavy household (for example 10 years at 6,000 transactions a year with splits, rules, notes and audit entries). How and where that measurement runs belongs to the separate performance-testing initiative, which may not use the regular test setup. The same thresholds can drive an in-app warning later.

_Consequences._ No database session to keep consistent with the UI; Discard is "drop the model". Memory and open time grow with history, which the size and open-time budget watches.

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

_Implementation._ `applyCommand` in `packages/core/src/commands/` looks the command's kind up in one map of kind to planner function (a new command is one entry and one function; the type forces an entry per kind), which plans it into a change set, runs `checkLocks` on its `touchedMonths`, then applies it; the model is never changed in place. Callers supply ids and dates, so a command is deterministic. Each part records an entity's value and list position before and after, so `invertChangeSet` restores the model exactly (a property test checks this). Account and category parts are `global` (AD-5); month-scoped parts arrive with the plans that own months. The transaction check an account rule needs (delete, change type) comes in through `CommandContext`, since transactions belong to a later plan. An account's archive history is a list of dated periods, and `isIncludedInMonth` reads it (S1.14, S1.15).

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
