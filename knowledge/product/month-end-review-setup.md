# PRD area S: Setup and accounts

Part of [Month-End Spending Review](month-end-review.md). A new budget file starts with the current month only; trends build as months are closed.

| ID   | Requirement                                                                                                                                                              | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| S1.1 | Creating a file asks for a name and produces a budget file that opens immediately                                                                                        | must     |
| S1.2 | An account has: name, type, provider profile, "include in month-end analysis" flag, and how money moved into it counts (savings / spending / chosen)                      | must     |
| S1.3 | Account types offered: chequing, savings, credit card, RRSP, TFSA, RESP, other investment, mortgage, other/custom                                                         | must     |
| S1.4 | Defaults by type: investment types are excluded and count as savings; mortgage is excluded and counts as spending (housing); other/custom asks which at add time          | must     |
| S1.5 | Each account takes a starting balance dated the day before its first imported transaction                                                                                | must     |
| S1.6 | The category template step offers Copy from an existing budget file (categories and rules, including provider rules), Detailed household, and Simple                    | must     |
| S1.7 | After choosing a template, categories can be renamed, added and removed at main and sub level; Income can be renamed but never removed                                   | must     |
| S1.8 | The last setup step imports the current month's CSVs via the normal import flow ([I](month-end-review-import.md))                                                       | must     |
| S1.9 | Accounts can be added, edited and archived at any time after setup; an archived account keeps its history and is no longer asked for at close                             | must     |
| S1.10 | Assets and debts with no CSV (house, car, family loan) are not part of setup; they are added from Net worth ([N](month-end-review-net-worth.md))                          | must     |
| S1.11 | Setup may be left unfinished; the file opens with whatever was entered and missing steps remain reachable from their normal screens                                      | should   |

Flow and rules: setup is a dialog launched from the start screen. Changing an account's analysis flag or transfer treatment after months are closed does not alter locked months.

Assumptions: the exact contents of the Detailed household and Simple templates are drafted at planning time and reviewed with Jeremy; an account's type can change only before its first import.
