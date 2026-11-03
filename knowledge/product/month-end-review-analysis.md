# PRD area A: Analysis and trends

Part of [Month-End Spending Review](month-end-review.md). Version 1 looks back: each month vs the previous month and vs a recent average. Target budgets are version 2.

| ID    | Requirement                                                                                                                                                                 | Priority |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| A1.1  | Month overview shows totals, spending by category, notes and review status, with this month vs last month and vs average                                                    | must     |
| A1.2  | Money in vs out shows income, spending and savings per month over 6 to 12 months, with the net result per month                                                             | must     |
| A1.3  | Category over months shows one category's spending across months at parent or sub level, each month vs the category's average                                               | must     |
| A1.4  | Month vs average lists every category this month against its rolling average, biggest increases and decreases first                                                         | must     |
| A1.5  | Transactions is a searchable list filtered by month, account, category and status                                                                                           | must     |
| A1.6  | Selecting any category, bar or month in a chart opens the transactions behind it                                                                                            | must     |
| A1.7  | Only accounts included in month-end analysis count, and confirmed transfers and transactions marked as confirmed fraud ([I](month-end-review-import.md) I1.22) are left out | must     |
| A1.8  | The rolling average defaults to 6 months, switchable to 3 or 12 in each view, and counts only locked months                                                                 | must     |
| A1.9  | Refunds reduce spending in their own category                                                                                                                               | must     |
| A1.10 | Income uses an Income parent category with subcategories Salary, Government benefits, Interest and dividends, Gifts, Other; shown as household totals, never per person     | must     |
| A1.11 | A split transaction contributes each part to its own category                                                                                                               | must     |
| A1.12 | Savings are shown apart from spending, never inside it                                                                                                                      | must     |
| A1.13 | With fewer locked months than the average length, the average uses what exists and the view states how many months it is based on; with none, comparisons are hidden        | must     |
| A1.14 | Totals for a closed month are identical every time they are shown, across all views                                                                                         | must     |

Flow and rules: open months show live figures marked as not final; they are never included in averages.

Assumptions (not in the write-up): A1.13 (averages with fewer locked months than the window, comparisons hidden with none) and A1.14 (closed-month totals identical in every view, the testable form of the primary success measure) are proposed; open-month figures are marked as not final.
