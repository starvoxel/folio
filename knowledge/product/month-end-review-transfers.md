# PRD area T: Transfers, savings and excluded accounts

Part of [Month-End Spending Review](month-end-review.md). Money moving between our own accounts is never spending; where it goes decides whether it counts as savings or drops out.

| ID   | Requirement                                                                                                                                                                         | Priority |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| T1.1 | The app suggests a transfer pair from two transactions on two of our accounts with equal and opposite amounts within N days of each other (default 5, adjustable in Settings)        | must     |
| T1.2 | A suggested pair can be confirmed, dismissed, or later unpaired; unpaired items can be paired manually                                                                              | must     |
| T1.3 | Confirmed pairs are excluded from spending and income everywhere                                                                                                                    | must     |
| T1.4 | Each account has "Include in month-end analysis"; an excluded account's own transactions are left out of spending and income, transfers into it still count as savings or spending per T1.5, and it still counts toward net worth                             | must     |
| T1.5 | For a transfer into an excluded account, the account's setting decides whether it counts as savings or spending                                                                     | must     |
| T1.6 | Defaults by type: RRSP, TFSA, RESP and other investments → savings; mortgage → spending (housing); other/custom → chosen when added                                                  | must     |
| T1.7 | Mortgage payments count in full as housing spending; principal reaches net worth only through the mortgage balance                                                                  | must     |
| T1.8 | A transfer between two included accounts is neither spending nor savings                                                                                                            | must     |
| T1.9 | Suggested pairs that are neither confirmed nor dismissed block closing the month ([M](month-end-review-close.md))                                                                    | must     |
| T1.10 | Where a transaction could pair with more than one candidate, the closest date wins and the rest stay suggestions                                                                    | should   |
| T1.11 | Locked months' pairs are never changed by new imports or by unpairing in an open month                                                                                              | must     |

Flow and rules: matching runs on import and on demand. Savings is shown apart from spending in Money in vs out ([A](month-end-review-analysis.md)).

Assumptions (not in the write-up): T1.8 follows from "never spending"; T1.10 (closest date wins) and T1.11 (locked pairs never change) are proposed edge-case rules; if only one side of a transfer exists in imported data (the other account not yet imported), the transaction stays unpaired and is surfaced in review rather than counted as spending automatically.
