# Plan: Transfers and savings

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

Money moving between the household's own accounts is never counted as spending, and money going to savings is shown apart from spending. This is area T of the [product requirements](../knowledge/product/month-end-review-transfers.md) and it builds the classifier of [AD-3](../knowledge/architecture/09_01_domain_model.md#ad-3-one-classification-entry-point-frozen-at-close), the one place every view gets its totals from.

## Scope

- In: the classifier with all six steps and its treatments; pair suggestion; the commands to confirm, dismiss, unpair and manually pair; marking a transaction as a transfer out to savings or spending (T1.13); the pairing stage for import and an on-demand run; the locked-month rules (T1.11, T1.12); the transfer window setting in the file; a Transfers view for suggestions and pairs.
- Out: the review queue that suspicious and unresolved pairs continue into (M); the Settings page layout (each plan adds its own section, H assembles); fraud marking itself (import milestone 3 owns the commands; the classifier only reads them); the account flags and their screens (setup, already planned); close-time freezing of treatments (M).

## Approach

Decisions are AD-3 (classifier), AD-4 and AD-5 (commands; confirming a pair across a locked and an open month is the one part undo cannot split), AD-6 (a line, not a transaction, is classified), AD-8 (pairing is a pipeline stage), AD-11 (the window is a household setting). Affected arc42 sections: 03, 04, 09.

1. _The classifier is pure and first._ `classify(line, context) → Treatment` takes the owning areas' answers through narrow interfaces (fraud, accounts, pairs, categories), in the fixed order of AD-3, so no area knows another. It is built here, with steps 1, 2, 5 and 6 reading what setup, import and categorization already store, and steps 3 and 4 reading pairs.
2. _A suggestion is derived data, not stored._ Pairing proposes candidates from two lines on two of our accounts with equal and opposite amounts within N days (T1.1, default 5). Only a confirmed or dismissed decision is stored, so changing N or importing more data recomputes suggestions without migrations.
3. _The closest date wins_ (T1.10); the others stay suggestions. Ties on date go to the earlier-imported line, so the result is deterministic.
4. _Locked months are never paired by import_ (T1.11): a likely pair with a locked side produces a warning naming the month and recommending reopening, and no pair (T1.12).
5. _Treatment by destination:_ into an included account, neutral (T1.8); into an excluded account, the account's savings-or-spending setting (T1.5, defaults T1.6); a mortgage payment counts in full as housing spending (T1.7); a transfer out without a tracked destination counts as savings or spending as marked (T1.13).
6. _One-sided transfers stay unpaired_ and are surfaced to review, never silently counted as spending (PRD assumption).

## Milestones

Depends on: [setup and accounts](setup-and-accounts.md) milestone 1 (accounts and their flags); [CSV import](csv-import.md) milestone 3 (the transaction record, the confirmed-fraud command); [categorization](categorization.md) milestone 2 (a line's category and source). Milestones 1 to 3 here are pure. Milestone 4 needs import milestone 2 (the pairing seam); milestone 5 needs setup milestone 3 (real save).

### 1. The classifier

- Does: `Treatment` (`Income`, `Spending(category)`, `Savings`, `NeutralTransfer`, `Excluded(reason)`), the six ordered steps, a classification of a whole month (used by live views and, in M, frozen at close), and fixtures of invented households with a stated answer for every line.
- Acceptance criteria: each step has a case that decides and a case that passes through; fraud beats everything; a refund is negative spending in its own category; a split line is classified per part (A1.11); the same input gives the same treatment regardless of input order.
- Verified by: unit tests and a property test over generated households (the treatments of one month sum to its lines, none is lost or counted twice).

### 2. Pair suggestion

- Does: the candidate search over a month's lines, the closest-date rule, the window setting, and suggestions that skip already-decided and dismissed pairs.
- Acceptance criteria: equal and opposite amounts on two of our accounts within N days pair; one day past N does not; two candidates give the closest date; a dismissed pair is not suggested again; one side only stays unpaired; searching 30,000 existing lines for 500 new ones finishes within a stated time (proposed 1 second on a CI runner).
- Verified by: unit tests and one timed integration test.

### 3. Pair and transfer-out commands

- Does: confirm, dismiss, unpair, manual pair, mark transfer out to savings or spending (T1.13) and unmark, with month-tagged parts, inverses and the cross-month rule of AD-5.
- Acceptance criteria: a pair across a locked and an open month is refused with a message naming the month; unpairing in an open month never changes a locked pair (T1.11); each command inverts exactly; marking a transfer out needs no pair and changes the treatment as T1.13 says.
- Verified by: unit tests and the command-then-inverse property test.

### 4. Import and on-demand matching

- Does: the pairing stage replaces the null seam in the import pipeline (I1.14); matching runs on import and on demand from the Transfers view; the preview shows suggestions and the locked-month warning (T1.12).
- Acceptance criteria: an import of the second account's file turns a one-sided transfer into a suggestion; a likely pair with a locked side is not paired and warns; nothing is stored until Import is pressed.
- Verified by: unit tests on fixtures and the end-to-end import scenario.

### 5. The Transfers view

- Does: suggestions and confirmed pairs in one list with confirm, dismiss, unpair and pair-manually actions, the transfer-out action on a transaction, and the transfer window in Settings.
- Acceptance criteria: every action works by keyboard with accessible names; a pair shows both lines and both accounts; a changed window changes the next suggestion run and no stored decision; light and dark screenshots.
- Verified by: component tests, the integration run with the mock host, an end-to-end scenario.

### 6. Records and documents

- Does: a new decision record for how pairing and the window are stored if it differs from here, AD-3 updated as built, the design notes, arc42 `key_files`, the PRD assumptions closed where decided.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Requirements

- Privacy: no amounts, descriptions or account names in logs or errors; counts and ids only.
- Logging: pairing logs counts and timings at Debug; a refused cross-month pair logs the code at Info, never the lines.
- Accessibility: pair status has a text equivalent of any icon or colour.
- Reliability: a failure in matching leaves the model as it was and the import can still proceed without suggestions.

## Risks

- Two real transfers with the same amount inside the window pair wrongly. Mitigation: closest date wins, suggestions need confirming, unpair is always available, and the Transfers view shows both lines.
- The classifier becomes the most-touched module (every money view depends on it). Mitigation: it is pure, fixture-driven, and its order is a table; AD-3 says to revisit if the order grows past a handful of steps.

## Decisions

Answered by Jeremy, 2026-11-28:

1. Changing an excluded account's savings-or-spending setting recalculates open months only; locked months keep their frozen results (AD-3).
2. Suggestions show in this plan's Transfers view until the review queue exists; the queue then reuses its list item component.
