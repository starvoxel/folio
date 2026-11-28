# Plan: Categorization

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

Every imported transaction arrives with a category where a rule knows it, and every manual fix can become a rule, so manual work shrinks month over month. This is area C of the [product requirements](../knowledge/product/month-end-review-categorization.md): the rules engine of [AD-9](../knowledge/architecture/09_01_domain_model.md#ad-9-rules-run-in-a-computed-order), category management, splits, notes, the uncategorized list, the Transactions page and the Rules & categories page.

## Scope

- In: the rule model and the `rules` part schema (replacing the placeholder from the setup plan); the engine (conditions, computed precedence, safe patterns, dry-run impact); the commands for rules, categories (add, rename, merge, archive), manual category, split and note; the fill for the import plan's rules seam; provider rules travelling with their profile; Copy from an existing file gaining rules (S, decision 5); the Transactions page (search, filters, detail panel with "Why this category?", split editor); the Rules & categories page; the uncategorized list.
- Out: transfer pairing and the classifier (the [transfers plan](transfers-and-savings.md)); the review queue (M); chart drill-down into the Transactions page (A wires it, A1.6); online merchant lookup (Later); bulk tagging (Later).

## Approach

Decisions are AD-9 (computed order, RE2 or a time-limited worker for patterns), AD-3 (a category is one input of the classifier), AD-4 and AD-5 (commands; a rule change is one global part plus month-tagged recategorization parts), AD-6 (a transaction has lines; a split is several lines), AD-11 (provider profiles and their rules live in the file). Affected arc42 sections: 03, 04, 09.

1. _The engine is pure._ `evaluate(rules, line, account) → RuleMatch | none` and `order(rules)` have no I/O, clock or model access. Dry runs (C1.8, C1.9) are the same function mapped over open-month lines, so the preview and the effect cannot disagree.
2. _Precedence is computed, never stored_ (C1.7): most conditions, then provider before shared, then the manual priority number for ties only. The Rules page shows shadowed rules (AD-9).
3. _A manual category is a flag on the line_ (`categorySource: manual | rule(id) | none`). Rules never overwrite `manual` (C1.11), which also gives "Why this category?" (C1.10) for free.
4. _Locked months are untouched_ (C1.12, C1.18 aside): every recategorization part is tagged with its month and refused by the lock guard. A category rename or archive is a global part and shows everywhere without changing a total.
5. _Merge_ (C1.2) is one command: rules and open-month lines move to the target, locked months keep their stored treatment (AD-3), and the source stays as archived.
6. _Splits_ (C1.13) are lines on one transaction whose amounts sum to the original, checked by the schema and the command.
7. _Pattern conditions_ use the engine chosen in AD-9; an invalid pattern is rejected on save (assumption in the PRD).

## Milestones

Depends on: [setup and accounts](setup-and-accounts.md) milestones 1 and 2 (categories in the model, the `rules` part registered) and [CSV import](csv-import.md) milestone 3 (the transaction record and the rules seam). Milestones 1 to 3 here are pure and start once those are done. Milestone 4 needs setup milestone 3 (real save) and import milestone 6 (profiles in Settings). The pages (5 to 7) need Electron foundations milestone 3 only through the shell they sit in.

### 1. Rules engine

- Does: rule and condition types, the `rules` part schema, evaluation, computed order, shadow detection, the pattern engine (RE2, see Decisions), and fixtures of invented descriptions.
- Acceptance criteria: each condition kind has a matching and a non-matching case; the C1.7 order has a test for each tie-break; a catastrophic pattern (`(a+)+$`) cannot hang the engine; an invalid pattern is rejected; manual lines are skipped.
- Verified by: unit and property tests (the order is a total order and independent of input order).

### 2. Rule, category and line commands

- Does: commands for add, edit, reorder, disable, delete rule; add, rename, merge, archive category; set manual category; split; note; the impact (dry run) function; undo inverses and month tags.
- Acceptance criteria: each command inverts exactly; a rule save never changes a locked-month line (a stub locked month); merging moves rules and open-month lines and leaves locked lines as they were; a split that does not sum is refused; deleting a rule leaves assigned categories (PRD assumption).
- Verified by: unit tests and the property test that command then inverse restores the model.

### 3. Import seam and provider rules

- Depends on: import milestone 2 (the stage seam).
- Does: the rules stage replaces the null implementation (C and I1.14); rules run on import and when saved, open months only; a provider rule is stored with its profile and a new profile starts with none (C1.5, C1.6); Copy from an existing file also copies rules, provider rules included.
- Acceptance criteria: an import preview shows each row's suggested category and the rule behind it; re-importing and rules-on-save never change a manual line; a provider rule applies only to accounts using that profile; copying a file's rules never copies its transactions.
- Verified by: unit tests on fixtures and one integration test on a real temporary file.

### 4. Transactions page and detail panel

- Does: the Transactions page (search, month, account, category and status filters, A1.5 minus the chart drill-down), the detail panel with "Why this category?", the change-category flow that offers to make or update a rule and shows how many past lines it would change (C1.8), the split editor, the note field, and the uncategorized list (C1.14).
- Acceptance criteria: filters combine; a changed category offers a rule with the correct count; the split editor shows the remainder and refuses to save unless it is zero; every control has an accessible name and the table works by keyboard; light and dark screenshots.
- Verified by: component tests, the integration run with the mock host, an end-to-end scenario.

### 5. Rules & categories page

- Does: the rules list grouped by category and profile with search, match counts, last match, no-match-in-12-months and shadow flags (AD-9); the rule editor with provider picker and live impact preview; the category tree with add, rename, merge, archive and per-parent totals.
- Acceptance criteria: the impact preview lists the exact lines a save would change; reorder, disable and delete work from the keyboard; archiving a category in use offers a target category for its open lines and, if none is chosen, makes them uncategorized.
- Verified by: component tests and an end-to-end scenario.

### 6. Records and documents

- Does: AD-9 updated as built, the design notes, the PRD assumptions closed where decided, arc42 `key_files`, the README.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Requirements

- Security: a user pattern never runs on the built-in `RegExp`; patterns have a length limit and a per-run time or step limit; rules are untrusted input in a file and validated by schema on read (AD-2).
- Privacy: descriptions and amounts never reach a log, an error or a snapshot outside the invented fixtures; impact counts may be logged, lines may not.
- Logging: rule evaluation logs counts and timings at Debug; a pattern that hit its limit logs the rule id at Warn, never its text.
- Accessibility: accessible names on every control; colour is never the only mark of a flag.

## Risks

- A bad rule set can silently miscategorize many lines. Mitigation: the impact preview before save (C1.9), "Why this category?", and undo of the whole rule change.
- RE2 in WebAssembly adds a dependency and a licence check. Mitigation: the engine sits behind one function; if no maintained, permissively licensed build passes the check, the time-limited worker replaces it.

## Decisions

Answered by Jeremy, 2026-11-28:

1. Pattern engine: RE2 compiled to WebAssembly. Milestone 1 runs the licence check and, only if no maintained, permissively licensed build passes, falls back to a time-limited worker.
2. The Transactions page is built here, not in Reporting; the reporting plan wires drill-down to it.
3. Archiving a category in use offers a target category for its open-month lines; if none is chosen they become uncategorized (and so block closing until resolved). Locked months keep their stored treatment.
