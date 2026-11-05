# PRD area N: Net worth

Part of [Closeout](month-end-review.md). Net worth is in scope but ranked below the spending trends, so it ships after the core month-end views. It is recorded once per month, at close, and only locked months appear in its chart.

| ID    | Requirement                                                                                                                                                                                                          | Priority |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| N1.1  | The app calculates each account's month-end balance from the nearest known balance (a CSV balance column or a previously confirmed figure) plus or minus the transactions between                                    | should   |
| N1.2  | At close the user confirms or overrides each account's balance; overrides are noted                                                                                                                                  | should   |
| N1.3  | All accounts count, including those excluded from month-end analysis; liabilities (mortgage, cards, lines of credit) subtract                                                                                        | should   |
| N1.4  | Assets and debts with no CSV (house, car, family loan) are added by name from the Net worth screen                                                                                                                   | should   |
| N1.5  | Each free-form entry is valued once per month during close, defaulting to the last value                                                                                                                             | should   |
| N1.6  | Investment accounts are valued at close by entering market value; trades and dividends inside them are ignored and only money moving in or out matters, as a transfer                                                | should   |
| N1.7  | The chart shows total net worth over time split into assets and liabilities, with change since last month and since the start of the year                                                                            | should   |
| N1.8  | The chart shows locked months only, so its history never shifts                                                                                                                                                      | should   |
| N1.9  | Free-form entries can be renamed or switched between asset and debt at any time; a rename shows in every month, locked ones included                                                                                 | should   |
| N1.10 | A free-form entry that is gone is archived, not deleted; its past values stay in locked months and it is no longer asked for at close                                                                                | should   |
| N1.11 | Closing a reopened month again with changed balances flags later locked months for re-confirmation ([M](month-end-review-close.md))                                                                                  | should   |
| N1.12 | An account counts toward net worth in the months before it is archived and is ignored in every month in which it is archived, including the month it is archived; locked months keep the value they were locked with | should   |

Flow and rules: the whole area is "should" in priority terms because it can ship after the core views; the close checklist items that depend on it ([M](month-end-review-close.md) M1.5) are required only once this area ships.

Assumptions: switching a free-form entry between asset and debt retroactively changes locked months' net worth presentation (as the write-up specifies) but not their spending totals; this exception to "locked months never change" is accepted and should be confirmed by Jeremy.
