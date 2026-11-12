# Follow-up 2 prompt: Avalonia accessible table spike

Paste everything below the line into the existing Avalonia session (resume it) or a new session on this repository.

---

Your Avalonia slice has had its first and second rounds reviewed. The decision between Avalonia and Electron now hinges partly on one question: **can Folio have a truly accessible table on Avalonia, and what would it cost?** Your follow-up found that the stock DataGrid, even with your fix, exposes rows and cells but no table semantics: no Grid or Table pattern or interface, no row or column counts, and no real selected state (only the word "selected" appended to a row name). The Electron slice, by contrast, exposes real table semantics on Windows (GridPattern with 10,001 rows, per-row selection state), and partial ones on Linux and macOS.

This is a time-boxed spike (about half a working day), not a build. It produces evidence and an effort estimate, not a finished control. The same rules as before apply: stay on `spike/slice-avalonia`, never push elsewhere or open a pull request, report honestly, do not tune anything to improve a number, free and MIT-or-equivalent dependencies only (state any licence that is not plain MIT), and keep describing the app generically (a local-first personal finance app) in anything sent to outside services.

Start here:

1. `git fetch origin && git checkout spike/slice-avalonia`.
2. Re-read your own `FOLLOWUP-RESULTS.md` sections F3 and A1, and the Electron slice's accessibility findings: `git show origin/spike/slice-electron:FOLLOWUP-RESULTS.md` (section F3, and the NVDA stretch). Re-use your existing dump tools (`avalonia/tools/atspi_dump.py`, `uia-dump.ps1`, `ax-dump.swift`) and the memory test (`memtest`).
3. Write all results to `TABLE-A11Y-RESULTS.md` on your branch (new file; do not edit earlier results files, use a Corrections section if something earlier was wrong). Mark every statement measured, inferred or not measured. Commit and push as you go.

## Use of subagents (approved by Jeremy for the research items only)

Jeremy has approved dispatching research agents (subagents) for items T1, T2 and the research parts of T3, so that they can run in parallel with your own hands-on work. Conditions:

- Subagents are read-only researchers. They read source code, documentation, repositories and package pages, and report back. They must not edit files, push, open pull requests, create issues or comments, or run builds on this branch. You do all building, measuring, committing and CI work yourself.
- Give each subagent one narrow question, ask for file paths, line numbers, versions or tags and links for every claim, and ask it to separate what it read from what it inferred. Launch the independent ones at the same time.
- Treat everything a subagent returns as unverified. Before using a finding, open the cited file or page yourself and confirm it, or reproduce it with a test. In `TABLE-A11Y-RESULTS.md`, mark each finding that came from an agent, and say how you checked it and whether it held. Do not repeat an agent's claim you did not check.
- Do not use subagents for T4 or T5 (prototypes, measurements, screen-reader runs).

## T1. What Avalonia's accessibility layers can express (research; subagents allowed)

Read the source of Avalonia 12.1.5 (the pinned version; say which tag or commit) and answer, with file and line references:

1. Which provider interfaces exist in `Avalonia.Automation.Provider` and elsewhere (selection, scroll, value, range, toggle, expand and collapse, and any grid, table, or row and column providers)? Which built-in peers implement which?
2. **Windows (UI Automation):** which patterns does Avalonia's UIA layer map from provider interfaces, and does it map Grid, GridItem, Table and TableItem (there is a Win32 interop `IGridProvider`)? What would a custom peer need to implement for the Grid and Table patterns to appear?
3. **Linux (AT-SPI):** which AT-SPI interfaces does Avalonia's FreeDesktop backend implement (Accessible, Component, Action, Selection, Value, Table, TableCell, and so on), and where are they implemented? Is there any Table or TableCell support, and what drives it?
4. **macOS (NSAccessibility):** which roles and attributes does the macOS layer map for lists, tables, grids, rows and cells; is there support for row and column counts, row ranges, selected rows or cell coordinates?
5. For each layer: what an app can do with a custom automation peer in application code, and what would need a change to Avalonia itself. For every change to Avalonia itself, give a rough size (files touched, lines) and which platform it affects.
6. What accessibility properties of `AutomationProperties` (for example `PositionInSet`, `SizeOfSet`, `Level`, `ItemStatus`) actually reach each platform's tree? Your earlier dumps did not show `PositionInSet` or `SizeOfSet`; find out why.
7. Search the Avalonia issues, discussions and pull requests for work in progress on table or grid accessibility (including issue 267 and related items) and report status, dates and who is doing it.

## T2. Licence of the DataGrid and its forks (research; subagents allowed)

Jeremy plans to use the DataGrid code as a possible starting point for our own accessible table. Determine, from the repositories themselves:

1. The licence file and the licence named in the package metadata of `AvaloniaUI/Avalonia.Controls.DataGrid`, at the tag matching `Avalonia.Controls.DataGrid` 12.1.2.
2. The licence notices in the source file headers. The control was originally ported from Silverlight and WPF Toolkit code. Do any files carry a Microsoft Public License (Ms-PL) notice or other third-party notices? Count the files by notice type, and list any NOTICE, THIRD-PARTY or licence-avalonia style files.
3. The same for the community fork ProDataGrid (`wieslawsoltes/ProDataGrid`) and anything else a quick search shows as a maintained MIT-licensed fork of the DataGrid.
4. In plain words, what the conditions would be for us to copy a DataGrid file into our repository and modify it, and for distributing a compiled app built from it, for whatever licences you found. Quote the licence text you rely on and say plainly that this is a reading of the text and not legal advice.

## T3. Candidate tables: ProDataGrid and the DataGrid with custom peers

Research parts (subagents allowed): for ProDataGrid, report maintenance facts (last commit and release dates, committers in the last 12 months and their share, open issues and pull requests, release cadence, funding if stated), its stated accessibility and automation features, its target Avalonia versions (does it support 12.1.5), its API differences from the stock DataGrid, and whether it needs paid components. Check any claims about accessibility by looking at its automation peer source.

Hands-on parts (you, no subagents): see T4.

## T4. Prototypes and measurements (you, hands on)

Build the smallest version of each candidate that renders the slice's Transactions grid with the 10,000-row fixture, sorting, selection and the side panel, then take the same accessibility dumps and the same memory and scroll measurements as in `RESULTS.md` and `FOLLOWUP-RESULTS.md`:

- **C0. Baseline:** the stock DataGrid with your A1 fix, already measured. Reuse the numbers.
- **C1. DataGrid with custom automation peers.** Subclass the DataGrid, its rows and its cells (or use the cheapest route the source allows) and override the automation peer creation to implement whichever provider interfaces T1 found, so that, as far as the platform layers allow, the table reports a grid role, row and column counts, the position of each row, real selected state, and cell coordinates. Do not copy the DataGrid source into the repository unless a subclass cannot do it. If you do copy any file, say which and note its licence per T2.
- **C2. ListBox-based table.** A header row of sortable buttons and a virtualized ListBox whose items are templated rows with shared column widths, real selection, keyboard navigation (arrows, Home, End, Page Up and Down) and a row automation name. Build only enough to measure: no column resizing or reordering unless you can do it quickly, and note what was left out.
- **C3. ProDataGrid** if T3 shows it supports Avalonia 12.1.5 and a free licence. Swap it in with the least code and measure it. If it does not build against 12.1.5, record how far you got.

For each candidate that runs, produce:

1. Platform accessibility dumps on Linux (AT-SPI), Windows (UI Automation) and macOS (AX) for: the table, a header, a row, a cell, a selected row, and the table after scrolling to the end. Say per OS whether each of the following is reported: a table or grid role, the total row and column counts (and whether the count is 10,000 or only the realized rows), row position, real selected state, and cell coordinates.
2. The G2 numbers on the same CI runners as before: worst frame time, sort time, and memory at P2 and P3 with the same per-OS metric (PSS, private working set, footprint).
3. Effort: active time spent, lines of code, and what you could not finish. Then your honest estimate of the extra time needed to reach production quality for that candidate (sorting, column resizing, keyboard behavior, text measurement for mixed scripts, copy to clipboard, theming in light and dark, tests), as a range with your reasoning.

## T5. Real screen reader (you, hands on; time-box about 45 minutes in total)

Using a current, free tool such as Guidepup (check that it is current and free, as the Electron session did with version 0.40.0), run NVDA on the Windows runner against the best-performing candidates from T4 and also the stock DataGrid with your A1 fix as the baseline. Use the same scenario as the Electron session so the results compare: focus the grid, press ArrowDown several times, report exactly what NVDA announces (row and column numbers, cell by cell or row by row, whether "selected" is announced), then open the dialog and report what is announced. Try VoiceOver on `macos-latest` and report if it cannot start (the Electron session could not). Orca on Linux only if time allows. Report timings and the crude nature of the check plainly.

## T6. Answer the decision question

End `TABLE-A11Y-RESULTS.md` with a short section, written for someone deciding between Avalonia and Electron, that answers:

1. Is a table with true table semantics (counts, position, real selection, cell coordinates) achievable on all three OSes **in application code only** on Avalonia 12.1.5? If not, which OS and which semantics are blocked, and what exact change to Avalonia would unblock each (from T1, with size estimates)?
2. A comparison table: candidates C0 to C3 against Linux, Windows and macOS (table role, counts, row position, selected state, cell coordinates, NVDA behaviour), plus G2 numbers, effort, licence and maintenance risk.
3. Your recommended path and total effort range to get an accessible table that Folio could ship, and the largest remaining risk. Include what the Electron slice's grid achieved for comparison, and where it also fell short (its NVDA run moved cell by cell and announced no "selected").
4. Anything in the earlier results that this spike shows was wrong.

If T1 shows early that Avalonia's platform layers cannot express table semantics at all, say so at once (commit and push a short note), still complete C2 and the T5 baseline runs, and spend the remaining time on a precise description and size estimate of the upstream changes, not on prototypes that cannot work. Finish by summarizing where things stand.
