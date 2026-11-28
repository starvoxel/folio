# Plan: Reporting

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

A household sees each month broken down, compared with last month and with its recent average, and can click any figure to see the transactions behind it. Closed-month totals read the same everywhere. This is area A of the [product requirements](../knowledge/product/month-end-review-analysis.md).

## Scope

- In: the pure reporting model over classified months; chart models and the four chart types of [AD-13](../knowledge/architecture/09_04_ui_and_structure.md#ad-13-charts-are-echarts-behind-chart-models) with their table equivalents; the Overview totals cards; the Reporting page (month breakdown, Money in vs out, Category over months, Month vs average); drill-down into the Transactions page.
- Out: the Transactions page itself, its filters and detail panel (the [categorization plan](categorization.md), milestone 4); the Overview status, checklist, notes and history (the [month-end plan](month-end-review-and-locking.md), milestone 6); budget targets (version 2); printable summary and CSV export (Later); net worth charts (N).

## Approach

Decisions are AD-3 (every number comes from the classifier; locked months from stored results), AD-13 (ECharts behind chart models; every chart has a keyboard-reachable table; money is integer cents, never a float), AD-14 (thin components over pure modules) and AD-15 (Fluent contained). Affected arc42 sections: 03, 04, 09.

1. _One source._ `monthReport(model, month)` returns locked months from stored results and open months classified live, marked not final (A1.14). No view computes a total itself; an architecture check fails a chart model that imports the transaction list.
2. _The average counts only locked months_ (A1.8), 6 by default and switchable to 3 or 12 per view. With fewer locked months than the window it uses what exists and says how many; with none, comparisons are hidden (A1.13).
3. _Chart models are pure_: series data in cents, colours from the design tokens, a click target for each element that names a drill-down filter (A1.6), and a table with the same numbers. ECharts sits behind them and registers only the components used.
4. _The donut rules are data, not drawing:_ the main level lists every parent; the subcategory level shows the top nine plus Other; uncategorized is separate and never inside Other (A1.16). Overspend is spending plus savings above money in (A1.18).
5. _Drill-down is a filter object_ (month, account, category, treatment) handed to the Transactions page, so chart, legend row and table row all open the same list.

## Milestones

Depends on: [transfers and savings](transfers-and-savings.md) milestone 1 (the classifier); [month-end review](month-end-review-and-locking.md) milestones 1 to 3 (stored results) and 6 (the Overview page); [categorization](categorization.md) milestone 4 (the Transactions page). Milestones 1 and 2 are pure and start once the classifier and the month record exist.

### 1. The reporting model

- Does: `monthReport`, month vs last month, rolling averages with the window and the months-used count, category-over-months series at both levels, and money in, spending, savings and left over.
- Acceptance criteria: a closed month gives identical numbers when read live-style and from storage; an open month is marked not final and never enters an average; averages with two locked months and a six-month window use two and say so; refunds reduce their category; a split contributes each part to its own category; savings never appear in spending; accounts excluded from analysis and confirmed fraud and transfers are absent.
- Verified by: unit and property tests on the fixtures of the classifier.

### 2. Chart models

- Does: donut, stacked bar, column bars and diverging bars as chart models with table equivalents and drill-down filters; the ECharts bindings; the accessible label (AD-13's own, not ECharts').
- Acceptance criteria: each model's numbers equal its table's; the top-nine-plus-Other rule and the uncategorized rule hold; a zero month and a one-month history render without error; money is formatted from integers.
- Verified by: unit tests of the models and component tests of the bindings.

### 3. Overview totals and the month breakdown

- Does: the totals, spending by category and this-month-vs-average cards on Overview (A1.1), and the Reporting page opening on the month breakdown: both donuts, the spent, saved or left over bar and the overspend flag (A1.15 to A1.19).
- Acceptance criteria: the breakdown matches a closed month's stored totals exactly; switching main and subcategory level keeps the totals equal; an open month shows the not-final mark; legend rows are real buttons; light and dark screenshots.
- Verified by: component tests, the integration run with the mock host, an end-to-end scenario.

### 4. The trend views

- Does: Money in vs out over 6 to 12 months with its table, Category over months with the average line, and Month vs average sorted by change.
- Acceptance criteria: the diverging view lists biggest increases and decreases first; changing the average length changes only that view; a category archived or merged still shows in locked months under its stored name or merged target as AD-3 stores it.
- Verified by: component tests and unit tests of the sorting.

### 5. Drill-down

- Does: every chart element, legend row and table row opens the Transactions page with the filter (A1.6).
- Acceptance criteria: the transactions opened sum to the figure clicked, for every chart element, in a test that clicks each one on a fixture household.
- Verified by: the integration run and an end-to-end scenario.

### 6. Records and documents

- Does: AD-13 updated as built, the design notes, the PRD assumptions closed where decided, arc42 `key_files`.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Requirements

- Privacy: charts and tables render locally; no chart code makes a request (the privacy capture covers every page).
- Accessibility: every chart has a table beside it and real-button legend rows; colour is never the only encoding (patterns or labels); ECharts' own label stays off.
- Performance: building every report for ten years of fixture data finishes within a stated time (proposed 500 ms on a CI runner); the full budget belongs to the performance initiative.

## Risks

- Drill-down counts drift from chart totals. Mitigation: both derive from one classified month, and milestone 5 tests every element.
- The chart models are the first use of ECharts in the app. Mitigation: milestone 2 runs before any page, and the privacy capture runs against the first chart.

## Open questions

1. Which colours encode the categories when there are more than the palette? [Jeremy, at milestone 2] _Recommendation:_ a fixed ordered palette by category id, repeating with patterns; a user-chosen colour is a later idea.
2. Is the month picker's default the latest open month or the latest closed one? [Jeremy] _Recommendation:_ the oldest open month, since it is the one being worked on.
