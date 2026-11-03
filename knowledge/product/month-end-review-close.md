# PRD area M: Month-end review and locking

Part of [Month-End Spending Review](month-end-review.md). Closing freezes a month's transactions, balances and notes; this is what makes the numbers trustworthy.

| ID    | Requirement                                                                                                                                                                  | Priority |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| M1.1  | Review is an exceptions queue by default listing: new merchants, uncategorized items, unusually large amounts, suspicious-transaction flags, and suggested transfer pairs                                  | must     |
| M1.2  | An optional full pass steps through every transaction in the month                                                                                                           | should   |
| M1.3  | Resolving a queue item removes it; an item sent back for categorizing returns to the queue when fixed                                                                        | must     |
| M1.4  | Each month has a free-text note, editable any time and kept with the month once locked                                                                                       | must     |
| M1.5  | The close checklist shows: every included account covered through month end, or short of it by no more than N days (a warning, see M1.15); no uncategorized transactions; transfer suggestions resolved; closing balances confirmed; free-form net worth entries valued; notes (optional) | must     |
| M1.6  | Close is disabled while any blocking checklist item is unmet and says which; warn-and-confirm items (M1.15) do not block | must |
| M1.7  | Closing locks the month: imports, rule changes and edits cannot change its transactions or totals                                                                            | must     |
| M1.8  | Closing happens after the month ends; typical timing is one to three weeks later when statements arrive                                                                      | must     |
| M1.9  | Reopening lives in the month's overflow menu, not the main screen                                                                                                            | must     |
| M1.10 | Reopening asks for confirmation more than once, explains what will change (such as later net worth figures), and requires a short reason kept in the month's history         | must     |
| M1.11 | If a reopened month's balances change, every later locked month must be reviewed and re-confirmed before its net worth figure is trusted                                      | must     |
| M1.12 | Each month shows status: open, ready to close, closed, or reopened needing re-confirmation                                                                                   | should   |
| M1.13 | A month's history lists closes, reopens and reasons with dates                                                                                                               | should   |
| M1.14 | Closing a month is undoable only through the guarded reopen, not Undo                                                                                                        | must     |
| M1.15 | When an account that was active during the month has a covered-through date short of month end by N days or fewer (default 3, set in Settings), closing shows a warning naming the account and the gap and proceeds only after confirmation; a larger gap blocks closing. Months before an account was last unarchived never count against it ([S](month-end-review-setup.md) S1.15) | must |

Flow and rules: "unusually large" and "new merchant" thresholds are defined at planning time. Data kept: notes, close and reopen history, confirmed balances.

Assumptions (not in the write-up): M1.15 relaxes the write-up's requirement that every account be covered through month end, per the review comment on I1.12 (the N=3 default is an assumption); per-account review is S1.20; M1.3 (queue items resolve and reappear when sent back), M1.12 and M1.13 (status labels, history list) and M1.14 (close is not undoable except by guarded reopen) are proposed; a month cannot be closed while an earlier month is still open (so history locks in order); this is stricter than the write-up and needs Jeremy's confirmation.
