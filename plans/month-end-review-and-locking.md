# Plan: Month-end review and locking

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

A household reviews a month's exceptions, writes a note, closes the month, and from then on its totals never change unless the month is deliberately reopened. This is area M of the [product requirements](../knowledge/product/month-end-review-close.md) and the primary success measure of the product. It turns on the lock guard of [AD-4](../knowledge/architecture/09_01_domain_model.md#ad-4-every-change-is-a-command-checked-by-one-lock-guard) for the first time and freezes results through [AD-3](../knowledge/architecture/09_01_domain_model.md#ad-3-one-classification-entry-point-frozen-at-close).

## Scope

- In: the `months` part schema and month state; the close checklist (pure); close, reopen and re-confirmation commands; month history; frozen results and totals; the review queue and full pass; the month note; the Overview page's status, checklist, notes and history cards; the Close page; the thresholds in the file.
- Out: totals, charts and the spending lists on Overview (A); net worth balances and entries (N; the checklist items for them are present and report "not applicable" until N ships, as M1.5 allows); undo and its history handling (H, which consumes the month tags); backup rotation (H).

## Approach

Decisions are AD-3 (close stores each line's treatment and the month's totals), AD-4 (the lock guard reads locked months from the model), AD-5 (closing removes that month's parts from undo entries), AD-10 (close, reopen and re-confirm are audit entries), AD-12 and H1.6b (close and reopen save at once). Affected arc42 sections: 03, 04, 09.

1. _Month state is derived where it can be._ Open, ready to close and needing re-confirmation come from the checklist and flags; only closed, its frozen results, notes and history are stored (M1.12).
2. _The checklist is a pure function_ of the model and settings returning each item with `met`, `warn` or `blocked` and a reason string naming accounts and gaps (M1.5, M1.6, M1.15, M1.17). The Close page only renders it.
3. _Close freezes_ every line's treatment and the totals by calling the classifier once, writes them to the `months` part, tags the change set with the month and saves immediately. After that the month is reported from stored data, so a later fix to the classifier cannot change it (AD-3).
4. _Reopen is guarded and rare:_ in the month's overflow menu, with more than one confirmation, an explanation of what changes, and a required reason kept in the history (M1.9, M1.10). It is not undoable (M1.14), and reopening alone flags nothing.
5. _Re-confirmation:_ closing a reopened month with changed balances flags every later locked month; the flagged month shows Re-confirm and its net worth is not trusted until then (M1.11). The balance comparison goes through the net worth seam, so it is inert until N ships.
6. _The queue is a computed list_ of new merchants, uncategorized lines, unusually large amounts, undismissed suspicious flags and unresolved transfer suggestions, with thresholds in the file (M1.1). Resolving an item recomputes the list; an item sent back to categorizing returns when fixed (M1.3).
7. _The month tag on every part makes the lock guard real:_ import, rule changes and edits touching a locked month are refused by the guard (M1.7), proven by the existing stub tests becoming real ones.

## Milestones

Depends on: [transfers and savings](transfers-and-savings.md) milestone 1 (the classifier) and milestone 3 (pair decisions); [categorization](categorization.md) milestones 2 and 4 (uncategorized list); [CSV import](csv-import.md) milestone 3 (coverage, suspicious flags); [setup and accounts](setup-and-accounts.md) milestone 3 (real save, for H1.6b). Milestones 1 to 4 here are pure and start once the first three are done.

### 1. Month state and the real lock guard

- Does: the `months` part schema, the month record (state, frozen results, note, history), and `checkLocks` reading it.
- Acceptance criteria: a command touching a locked month is refused whatever its source (import, rule save, edit); a file with locked months round-trips byte-identical; domain types also refuse a locked-line edit (AD-4).
- Verified by: unit tests and the property test over generated change sets.

### 2. The checklist

- Does: the pure checklist with every item of M1.5, the coverage tolerance of M1.15 (warn within N days, block beyond), earlier months closed (M1.17), and archived-account handling (S1.14).
- Acceptance criteria: each item has a met, a warn (where it exists) and a blocked case; an account archived during the month is excluded for that month; closing out of order is blocked and says why; the net worth items report not applicable.
- Verified by: unit tests on fixtures.

### 3. Close and its frozen results

- Does: the close command with immediate save, the stored treatments and totals, the audit entry, the history record, and the undo rule that close is not undoable and removes that month's parts from earlier entries.
- Acceptance criteria: totals read after close equal totals read before it and after a re-open of the file (the primary measure); a classifier change after close does not change a closed month; a month tagged part is gone from undo entries and other months' entries remain; a failed save leaves the month open.
- Verified by: unit and property tests, and an integration test on a real temporary file.

### 4. Reopen, history and re-confirmation

- Does: reopen with its reason and history entry, the closed-again flagging of later months, Re-confirm and its history, coverage-gap confirmations and balance overrides as history entries (M1.13).
- Acceptance criteria: reopen needs a reason; reopening alone flags nothing; closing again with changed balances flags every later locked month; re-confirming records an entry; reopen is not offered on the main screen.
- Verified by: unit tests.

### 5. The review queue

- Does: the queue with its five groups and thresholds (the defaults in Decisions, adjustable in Settings), item actions, the full pass (M1.2), "Mark all as checked", and continue to close.
- Acceptance criteria: each group has a tripping and a non-tripping case; resolving removes an item and sending it back returns it when fixed; changing a threshold changes the next queue and no closed month; the queue is operable by keyboard with accessible names.
- Verified by: unit tests, component tests, an end-to-end scenario.

### 6. Overview cards and the Close page

- Does: the status banner, checklist card, note editor, history with "Reopen month…" in the overflow menu, the Close page of numbered steps, and the "closed and locked" banner. The Overview page is created here; A adds its totals cards.
- Acceptance criteria: Close is disabled while a blocking item is unmet and says which; a warn item needs one confirmation; the note stays editable after close; every control has an accessible name; light and dark screenshots of open, ready, closed and needs-re-confirmation.
- Verified by: component tests, the integration run, and the end-to-end close and reopen scenario.

### 7. Records and documents

- Does: AD-3 and AD-5 updated as built, a decision record for the stored month shape, the design notes, the PRD assumptions closed where decided, arc42 `key_files`.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Requirements

- Security: the `months` part is validated on read; frozen data in a file that fails its checksum is never trusted (AD-2).
- Privacy: the history stores reasons the person typed, so they stay in the file and never reach a log.
- Logging: close, reopen and re-confirm log the month and outcome at Info; a refused locked-month change logs the code at Info.
- Accessibility: the confirmation steps of reopen are focus-trapped and keyboard-operable.

## Risks

- A bug in close corrupts a month that is then trusted. Mitigation: close is atomic (one change set, saved at once), frozen results are compared with a fresh classification in a test, and a backup exists from open (AD-12).
- The net worth seam is inert until N, so M1.11 cannot be proven end to end here. Mitigation: test it with a stub balance source; N repeats it with real balances.

## Decisions

Answered by Jeremy, 2026-11-28:

1. "Unusually large" reuses import's check (at least $500 and at least three times the account's median row); a new merchant has no earlier line in any month. One definition for import and review; both adjustable in Settings.
2. The full pass stores no flag: "Mark all as checked" only clears the session's list.
