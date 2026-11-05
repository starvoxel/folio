# PRD: Folio

Source: product write-up of 2026-11-02 (Jeremy). Per-area requirements live in the linked docs; this file owns the shared context.

## Problem

Our household spreads money across credit cards, chequing, savings and investments. Reviewing a month means exporting each account, sorting transactions by hand, and guessing at totals that double-count transfers and card payments. Past months drift as data is re-sorted, so trends are untrustworthy.

## Users

One household, several members sharing one budget file. All members have equal access; there are no per-person views, roles or logins.

## Goals and non-goals

- Goals
  - One place for every account via CSV, with no bank logins.
  - Little manual sorting: automatic categorization where every fix teaches a rule.
  - Honest totals: transfers and card payments never double-counted; savings apart from spending.
  - A month-end ritual: review, note, then close and lock the month.
  - Reporting: each month vs last month and vs average; net worth over time.
- Non-goals (v1): see [Later versions and out of scope](#later-versions-and-out-of-scope).

## Constraints

| Area           | v1 choice                                                                                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platform       | Desktop app, Avalonia + FluentAvalonia (Windows, macOS, Linux); standards `csharp_base`, `csharp_avalonia`                                                                                                               |
| Users          | One household sharing the file                                                                                                                                                                                           |
| Storage        | Local budget file opened like a document; may sit in a shared folder. Format: a zip of JSON and JSONL parts ([AD-2](../architecture/09_architecture_decisions.md#ad-2-the-budget-file-is-a-zip-of-json-and-jsonl-parts)) |
| Saving         | Autosave every X minutes (configurable) plus manual save; undo/redo for the session                                                                                                                                      |
| Data sources   | CSV only                                                                                                                                                                                                                 |
| Privacy        | Data stays in the file on our computers; nothing leaves unless opted in; no bank connections. No telemetry is an assumption, implied by the write-up                                                                     |
| Online lookups | Off by default; opt-in; only services that neither keep nor sell data                                                                                                                                                    |
| Currency       | CAD only                                                                                                                                                                                                                 |
| Concurrency    | Two simultaneous editors not handled                                                                                                                                                                                     |

## Success measures

- Totals of a closed month never change unless it is deliberately reopened (the primary measure).
- Assumption, not in the write-up: categorization effort falls month over month, with manual fixes per import trending down as rules accumulate.
- Assumption, not in the write-up: a month can be imported, reviewed and closed without leaving the app or editing a spreadsheet.

## Feature areas

| Area | Doc                                                                       | Covers                                                       |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------------------------ |
| S    | [Setup and accounts](month-end-review-setup.md)                           | New file, accounts, opening balances, category templates     |
| I    | [Importing](month-end-review-import.md)                                   | CSV intake, provider profiles, preview, duplicates, coverage |
| C    | [Categorization](month-end-review-categorization.md)                      | Categories, rules, splits, uncategorized list                |
| T    | [Transfers, savings and excluded accounts](month-end-review-transfers.md) | Pairing, exclusions, how money into an account counts        |
| M    | [Month-end review and locking](month-end-review-close.md)                 | Review queue, notes, checklist, close, reopen                |
| A    | [Reporting](month-end-review-analysis.md)                                 | Month breakdown, money in/out, category trends, averages     |
| N    | [Net worth](month-end-review-net-worth.md)                                | Month-end balances, free-form entries, history               |
| H    | [App shell and settings](month-end-review-shell.md)                       | Start screen, navigation, undo/redo, settings, backups       |

Visual design: [design notes](month-end-review-design.md) derived from the HTML prototype in `design/`.

Net worth (N) requirements are all "should" because the area ships after the core views, even where a "must" in another area (M1.5, M1.11) references it; those "must"s apply once N ships.

Priority: areas S, I, C, T, M, A, H are the core month-end views and ship first; N ships after them (ranked below spending trends).

## Monthly flow

Import → Categorize → Review → Close. Review sends unresolved items back to Categorize. Closing feeds trend and net worth history. Reopening is possible but deliberately rare and guarded ([M](month-end-review-close.md)).

Months are calendar months; statements are not. Each transaction is filed under its own date, so one file can add to two months, and each account tracks how far its data is covered.

## Later versions and out of scope

| Item                                           | Status                      |
| ---------------------------------------------- | --------------------------- |
| Budget targets and goals per category          | Version 2                   |
| PDF statement import (reuses the preview step) | Later                       |
| Bulk tagging across categories                 | Later                       |
| Optional file password and encryption          | Later                       |
| Printable month summary and CSV export         | Later                       |
| Opt-in online merchant lookup                  | Research first, then decide |
| Two people editing at once                     | Not handled in v1           |
| Direct bank connections                        | Out of scope                |
| Currencies other than CAD                      | Out of scope                |
| Phone or web apps                              | Out of scope for now        |

## Assumptions and open questions

Open (decider in brackets):

- Online merchant lookup: which service, if any. [Research during planning; Jeremy]

Resolved: the budget file format is a zip of JSON and JSONL parts (decided 2026-11-05; see [architecture decisions](../architecture/09_architecture_decisions.md)).

Assumptions made while detailing the areas (each is a stated default, change freely):

1. Each area's detailing was done from the write-up alone; requirements the write-up did not specify are labelled in that area's doc under "Assumptions".
2. Amounts are stored and compared in exact CAD cents; no floating point.
3. A "month" is the calendar month of the transaction's posted date.
4. Autosave never changes a locked month; the only path to change one is reopen.
