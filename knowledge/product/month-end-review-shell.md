# PRD area H: App shell and settings

Part of [Month-End Spending Review](month-end-review.md). The app works like a document editor: open a budget file, work in it, and it saves itself.

| ID    | Requirement                                                                                                                                                                  | Priority |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| H1.1  | The start screen puts the last file front and centre with its status: open month, items to review, accounts waiting on imports, and last month closed                        | must     |
| H1.2  | An option opens the last file automatically at launch, skipping the start screen                                                                                             | should   |
| H1.3  | The start screen lists other recent files, Open another file, and New budget file; new-file setup opens as a dialog                                                          | must     |
| H1.4  | The navigation pane lists Overview, Transactions, Trends, Net worth, Accounts, and Rules & categories, with Settings at the bottom                                           | must     |
| H1.5  | The command bar always offers Import, Undo, Redo and the month picker                                                                                                        | must     |
| H1.6  | The file autosaves after every change                                                                                                                                        | must     |
| H1.7  | Undo and redo cover edits, recategorizations, rule changes and whole imports; history lasts for the session                                                                  | must     |
| H1.8  | Undo never alters a locked month                                                                                                                                             | must     |
| H1.9  | Settings hold provider profiles, transfer matching window, rolling average length, theme (light, dark, system) and opt-in online lookups                                     | must     |
| H1.10 | The app keeps automatic backups of the file                                                                                                                                  | must     |
| H1.11 | A missing, unreadable or corrupt file on open shows a clear error and offers to open a backup                                                                                | must     |
| H1.12 | All financial data stays in the budget file on the user's computers; nothing is sent anywhere unless an opt-in setting is on                                                 | must     |
| H1.13 | Opening the same file on two computers at once is not handled in v1                                                                                                          | should   |

Flow and rules: backup frequency, retention and location are decided at planning time. Visual design follows the [design notes](month-end-review-design.md), realized with FluentAvalonia.

Assumptions: because two concurrent editors are unsupported, the app may detect an in-use file and warn, but is not required to.
