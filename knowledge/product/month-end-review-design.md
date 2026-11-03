# Design notes: Month-End Spending Review

Source: HTML prototype [design/Month-End Spending Review.html](../../design/Month-End%20Spending%20Review.html) (2026-11-03, "not final, but close enough"). It is a reference for look and behavior, not code to port: the implementation is Avalonia with FluentAvalonia controls and its theme resources, so use the theme's resource keys instead of copying hex values or CSS. Requirements stay in [month-end-review.md](month-end-review.md); where this prototype differs from them, see [Differences from the PRD](#differences-from-the-prd).

## Boards

| Board | Size     | Content                                                                                                                 |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Start | 1200×760 | Last-file card with status, other recent files, Open / New actions, 3-step new-file dialog (Name, Accounts, Categories) |
| App   | 1440×960 | NavigationView shell with all pages, import dialog, light and dark themes                                               |

Sample data is a file named "Household 2026.budget"; the new-file dialog defaults to "Household 2027.budget".

## Visual foundations

The prototype uses FluentAvalonia's own v2 resources: colours from `Fluentv2Colors.axaml` in [amwx/FluentAvalonia](https://github.com/amwx/FluentAvalonia), structural values from its Resources docs page, and its icon font. The accent is fixed "Windows blue" rather than the OS accent.

| Aspect          | Value                                                                                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accent          | #0078D4; hover #106EBE (dark #2B88D8); pressed #005A9E; light fill #DEECF9 (dark #004275)                                                            |
| Page background | Base solid fill #F3F3F3 light, #202020 dark; cards are translucent white (light) or white at ~5% (dark) with a 1px card stroke                       |
| Text            | Primary / secondary / tertiary / disabled as the Fluent text-fill ramp (black at ~89%, 62%, 45%, 36% in light; white at 100%, 77%, 53%, 36% in dark) |
| Status colours  | Success #0F7B0F on #DFF6DD; caution #9D5D00 on #FFF4CE; critical #C42B1C on #FDE7E9 (dark: #6CCB5F, #FCE100, #FF99A4 on dark tints)                  |
| Font            | Inter 400/500/600/700 in the prototype; Avalonia build should follow the project font decision (Inter or the platform default)                       |
| Type scale      | Caption 12/16, body 14/20, body-strong 600, subtitle 20, title 28, title-large 40                                                                    |
| Shape           | Control radius 4, overlay radius 8, pill 999                                                                                                         |
| Spacing         | 4 / 8 / 12 / 16 / 24 / 32                                                                                                                            |
| Controls        | Min height 32, button padding 11,5,11,6; flyout padding 16                                                                                           |
| Icons           | Fluent icon font (FluentAvalonia's icon set)                                                                                                         |
| Elevation       | Cards 0 1 2 at 6%; flyouts 0 8 16 at 14%                                                                                                             |
| Themes          | Light, dark; Settings offers light / dark / system (H1.9)                                                                                            |

Implementation rule: map each token to the matching FluentAvalonia theme resource (for example text-primary → `TextFillColorPrimaryBrush`, card-bg → `CardBackgroundFillColorDefaultBrush`, solid-bg-base → `SolidBackgroundFillColorBaseBrush`, divider → `DividerStrokeColorDefaultBrush`) and verify the exact keys against the pinned FluentAvalonia version when building. Because the tokens are FluentAvalonia's own, the Avalonia app inherits them from the theme; define project resources only where the prototype adds its own (the status backgrounds).

## Shell

- Left `NavigationView` headed "Month-End Review", filling the window height.
- Items in order: Overview, Review (with the queue count, "Review · 7"), Transactions, Trends, Net worth, Accounts, Rules & categories. Settings is the footer item.
- Top bar: file name and "Saved automatically" with a "sample data" tag, Undo, Redo, Import CSV, and the month picker (ComboBox of months).
- Content max width about 1240, 20px vertical rhythm between sections, cards in auto-fit grids (210 and 440 minimum column widths).
- Close is a page reached from Overview or Review, not a nav item; Overview stays selected while it is open.
- Toasts (InfoBar) confirm actions, for example "<Month> is closed and locked".

## Screens

| Screen             | What the prototype shows                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Start              | Last-file card (name, folder, last opened), status tiles (open month and items to review, accounts waiting on imports with data-through date, last month closed and when), "Open budget" primary button; other recent files with their lock state; Open another file / New budget file                                                                         |
| New budget file    | 3-step dialog: name; accounts (name, provider, starting balance, running list); categories (template cards, editable tree with add/remove/rename, notes that Income cannot be removed and that assets without a CSV are added later)                                                                                                                           |
| Overview           | Month status banner (open / ready to close / closed / needs re-review) with Close or Mark-as-re-reviewed action; KPI tiles (value + note); spending-by-category list with this month vs average and click-through; month status checklist with "Open review queue"; month notes (locked with the month); month history with "Reopen month…"; largest purchases |
| Review             | Exceptions queue in groups (title, count, hint) with per-item actions (Confirm transfer / Not a transfer / Looks right / Open); "Full pass" toggle switching to every transaction with "Mark all as checked"; "Continue to close"                                                                                                                              |
| Close              | Four numbered steps with state icons: imports cover the month (per-account coverage), review queue empty, month-end balances for net worth (table: account or entry, source of figure, editable value, confirm; net worth total and change; Confirm all), optional month notes; footer with Back and "Close and lock <month>"                                  |
| Transactions       | Search and account/category filters; table (Date, Description, Account, Category, Amount) with note and weekday; empty state "No transactions match these filters."; side details panel with "Why this category?", make-rule action, and split editor (parts add up to the amount, remaining shown, Add part, Save split)                                      |
| Trends             | Tabs: Money in vs out (monthly bars plus table of in, spending, saved, left over); category over months (bars vs average); month vs average (diff list, left of the line is below average)                                                                                                                                                                     |
| Net worth          | Bar chart of locked months (bars start at a stated baseline so change is visible); breakdown at a chosen month by group; add asset or debt; inline rename and archive                                                                                                                                                                                          |
| Accounts           | Table: Type, Provider, Data through, Month-end analysis toggle, Money moved in counts as; add/edit form; note that included-account transfers pair automatically                                                                                                                                                                                               |
| Rules & categories | Tabs Rules and Categories; rule list (match text, extra conditions, category, match count); rule editor with provider-profile picker, live preview of past transactions it would change, Save and Delete; categories as parent totals with subcategories                                                                                                       |
| Settings           | Provider profiles (columns, date format, money-out direction); transfer matching window; theme (Light, Dark, System); online category suggestions toggle shown as planned and off                                                                                                                                                                              |
| Import dialog      | Drop zone plus Browse and recent downloads; provider detected from headers; column-mapping summary; preview table (date, description, amount, suggested category, status, Keep for duplicates); warning that locked-month rows are skipped and the account's new covered-through date; Back and Import                                                         |

## FluentAvalonia component mapping

| Prototype                                               | Avalonia / FluentAvalonia                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| NavigationView                                          | `NavigationView` with menu and footer items                                                                        |
| Button (standard, accent)                               | `Button`, `Classes="accent"` for the primary action                                                                |
| ComboBox (month, filters, provider)                     | `ComboBox`                                                                                                         |
| TextBox (search, notes, forms)                          | `TextBox`                                                                                                          |
| ToggleSwitch (Full pass, month-end analysis, auto-open) | `ToggleSwitch`                                                                                                     |
| ToggleButton (tabs and segment choices)                 | `ToggleButton` or `TabStrip`/`TabView` where it is a real tab                                                      |
| InfoBar (status banners, toasts, warnings)              | `InfoBar`                                                                                                          |
| Dialogs (new file, import, reopen confirmation)         | `ContentDialog`                                                                                                    |
| Cards, tiles                                            | `Border` with card resources                                                                                       |
| Tables                                                  | `DataGrid` (Transactions, Accounts, close balances, import preview)                                                |
| Charts (money in vs out, category bars, net worth bars) | Not a stock control; library choice (for example a charting package vs custom drawing) is an architecture decision |

## Differences from the PRD

Decisions for Jeremy; neither side is changed yet. Other than these, the prototype matches the PRD.

1. **Review is a nav item.** The prototype puts Review (with a queue count) in the navigation; the PRD (H1.4) lists Overview, Transactions, Trends, Net worth, Accounts, Rules & categories, Settings.
2. **Net worth in the close flow.** Step 3 of the prototype's close page confirms balances and net worth, which makes net worth part of closing; the PRD ranks net worth below the core views and lets it ship later (N, M1.5).
3. **Settings is missing the rolling-average length** (3, 6 or 12 months, H1.9); the prototype Settings has no such control, though the Trends views need it (A1.8).
4. **Review-driven changes the prototype does not yet show** (PR 1 review comments, 2026-11-03). The PRD is ahead of the prototype here; the prototype needs updating:
   - Hamburger menu in the top bar (H1.14) instead of relying only on the nav and command bar.
   - Save controls: unsaved-changes indicator and manual Save, replacing the fixed "Saved automatically" label (H1.6a).
   - Interactive Accounts: each row opens an account detail with current balance, covered-through, all transactions, per-account review and import (S1.16 to S1.22), and an Archived list (S1.14); today the page is a static table.
   - Close coverage rule: a short gap of N days or fewer closes with a confirmation warning (M1.15); the prototype's close step 1 treats any gap as blocking.
   - Suspicious-transaction flags with reasons in the import preview and review queue (I1.20 to I1.23).
   - Settings controls for autosave interval, coverage tolerance and suspicious-transaction thresholds (H1.9).
