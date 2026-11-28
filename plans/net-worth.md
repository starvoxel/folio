# Plan: Net worth

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

At each close the household confirms every account's balance and the value of its assets and debts, and the Net worth page shows how the total moved month over month, from locked months only. This is area N of the [product requirements](../knowledge/product/month-end-review-net-worth.md). It ships after the core views; its requirements are all "should".

## Scope

- In: month-end balance calculation from known balances; the `networth` part schema; free-form assets and debts (add, rename, switch type, archive); balance confirmation and override at close; the net worth totals frozen with the month; re-confirmation flags (M1.11); the Net worth page with its chart.
- Out: the close checklist, close command and history themselves (the [month-end plan](month-end-review-and-locking.md), which this plan fills seams of); investment trades and dividends (ignored by design, N1.6); the chart library choice (AD-13).

## Approach

Decisions are AD-3 (stored results at close), AD-6 and AD-7 (cents, lines), AD-13 (a line or area chart is a new chart model), AD-10 (overrides are audit entries). Affected arc42 sections: 03, 04, 09.

1. _A balance is computed, never typed in a ledger:_ nearest known balance (a CSV balance column or a confirmed figure) plus or minus the transactions between (N1.1). The function is pure and reads the import plan's known-balance records.
2. _Close stores the figures:_ each account's balance, each free-form value and the total go into the month's frozen record, so the chart never shifts (N1.8). Overrides keep a note.
3. _All accounts count_, including those excluded from analysis, liabilities subtract (N1.3), and an account counts until the month it is archived (N1.12). Investment accounts are valued by entering market value; only transfers in and out matter (N1.6).
4. _Free-form entries default to the last value_ and are asked for once per close (N1.5); gone means archived, with past values kept (N1.10). A rename shows in every month; switching asset and debt changes locked months' net worth presentation but not their spending totals, an exception Jeremy accepted (Decisions).
5. _The M seams become real:_ the checklist items for closing balances and free-form values, and the re-confirmation comparison (M1.11), take their implementations from here.

## Milestones

Depends on: [month-end review](month-end-review-and-locking.md) milestones 2 to 4 (checklist, close, re-confirmation seam) and 6 (Close page); [CSV import](csv-import.md) milestone 3 (known balances); [reporting](reporting.md) milestone 2 (chart models). The plan ships after rows 3 to 9 of the build order.

### 1. Balance calculation

- Does: the pure balance function, the net worth total with assets and liabilities, and the archive rule.
- Acceptance criteria: a CSV balance and later transactions give the right balance; a confirmed figure replaces a CSV balance as the nearest known one; an account archived in a month is ignored in that month; a mortgage subtracts; excluded accounts count.
- Verified by: unit and property tests.

### 2. Free-form entries and the `networth` part

- Does: the part schema, add, rename, switch type and archive commands, value-per-month records defaulting to the last value.
- Acceptance criteria: an archived entry keeps its locked values and is not asked for again; a rename shows in locked months and changes no spending total; each command inverts exactly.
- Verified by: unit tests and a round trip through the file codec.

### 3. Close integration

- Does: the checklist items and the close step 4 (the table of figures with source, editable value and confirm, "Confirm all"), overrides with their notes, the frozen figures, and the re-confirmation comparison.
- Acceptance criteria: closing stores every figure and a later import never changes it; an override carries its note and a history entry; closing a reopened month with a changed balance flags every later locked month and its net worth is marked untrusted until re-confirmed; closing without valued entries is blocked and says which.
- Verified by: unit tests, an integration test on a real temporary file, and the end-to-end close scenario extended.

### 4. The Net worth page

- Does: the chart of locked months split into assets and liabilities with change since last month and since the start of the year, the breakdown at a chosen month, add, rename and archive in place.
- Acceptance criteria: only locked months appear; the bars start at a stated baseline; a table with the same figures sits beside the chart; every control has an accessible name; light and dark screenshots.
- Verified by: component tests, the integration run, an end-to-end scenario.

### 5. Records and documents

- Does: AD-3 updated as built, the design notes, the PRD assumption on asset and debt switching closed, arc42 `key_files`.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Requirements

- Privacy: balances and entry names stay in the file; logs carry counts only.
- Logging: balance overrides and re-confirmations at Info by month and outcome, no figures.
- Accessibility: the chart's table and legend follow AD-13; negative and positive are not distinguished by colour alone.

## Risks

- A wrong nearest-known balance gives a wrong net worth that is then frozen. Mitigation: close shows the source of every figure and requires confirmation.
- Retroactive type switching changes locked presentation. Accepted (Decisions).

## Decisions

Answered by Jeremy, 2026-11-28:

1. Switching a free-form entry between asset and debt changes locked months' net worth as the PRD writes it; it never changes a spending total. This exception to "locked months never change" is accepted.
2. The chart starts at the first locked month; earlier months are not charted.
