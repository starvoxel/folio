---
section: '01'
title: 'Introduction and Goals'
lifecycle: draft
tags: [overview]
key_files: []
---

> What Folio is, the quality goals its architecture serves, and who cares about them.

## Requirements overview

A desktop app a household opens once a month to import every account's transactions from CSV, check them, and see where the money went, how it compares to normal, and how net worth is moving. Closing a month locks its numbers. The product requirements are in [knowledge/product/month-end-review.md](../product/month-end-review.md) and its per-area docs; this architecture does not restate them.

The flow is Import → Categorize → Review → Close. Most of the system's difficulty comes from one promise: a closed month's totals never change unless it is deliberately reopened. Rules, category merges, account settings, transfer pairing, undo, imports and fraud marking can all move numbers, and none of them may move a locked month's.

## Quality goals

| Priority | Goal                     | Motivation                                                                                      | Measurable criterion                                                                                                                                                                                                                               |
| -------- | ------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Locked-month stability   | The PRD's primary success measure; trends are worthless if past months drift                    | A locked month's totals and drill-downs are identical across every view, every app version, and after any sequence of edits, imports, rule changes and undos in other months (A1.14). Covered by property tests over the classifier and lock guard |
| 2        | Data safety              | One household's whole financial history lives in one file                                       | No sequence of crash, power loss or sync-client interference leaves a half-written file: saves are atomic, backups are kept, and a corrupt file is detected on open and offers a backup (H1.10, H1.11)                                             |
| 3        | Privacy                  | Data never leaves the computer unless the household opts in (H1.12)                             | No network access in normal operation; the automation server (AD-16) listens only on loopback and is off by default; no dependency phones home                                                                                                     |
| 4        | Testability              | Much of the code is written and reviewed by AI agents; correctness must be checkable by machine | Domain logic lives in a UI-free assembly with full unit tests; unit, integration and architecture tests each run on their own; the running app can be driven and inspected through a CLI (AD-16)                                                   |
| 5        | Replaceable presentation | The UI stack depends on single-maintainer and deprecated libraries                              | FluentAvalonia types appear only under one folder; charts sit behind view-models; swapping either touches no domain code (AD-13, AD-15)                                                                                                            |

## Stakeholders

| Role                   | Concern                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Household members      | Honest totals, little manual sorting, numbers that stay put once a month is closed, data that stays private         |
| Product owner (Jeremy) | Decides product and architecture trade-offs; approves plans                                                         |
| AI engineering agents  | A codebase whose rules are enforced by tests and analyzers, and a running app they can drive to validate their work |
