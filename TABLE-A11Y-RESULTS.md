# Table accessibility spike: Avalonia (TABLE-A11Y-RESULTS)

Branch `spike/slice-avalonia`. Time-boxed research and measurement spike, not a build. Every statement is marked **[measured]** (I ran it), **[read]** (I opened the cited source/page myself and confirmed it), **[agent-read, verified]** (a research subagent reported it, I re-opened the source and it held), **[agent, not verified]** (agent report I did not re-check; not relied on), **[inferred]** or **[not measured]**.

Subagents were used for T1, T2 and T3 research only (read-only, as approved). Their reports are treated as unverified; the "How checked" notes say what I re-opened. Anything I could not re-check is labelled as such and is not used in the conclusions.

## EARLY FINDING (written before any prototype): the platform layers cannot express table semantics in application code

Source pinned: Avalonia tag `12.1.5` = commit `5825bf8c66fba0c11e67c980d8ece6444576bffa` (a shallow clone, which I inspected myself after the agents' reports).

- **Windows (UI Automation): blocked in app code.** `AutomationNode.GetPatternProvider` returns a pattern only for ExpandCollapse, Invoke, RangeValue, Scroll, ScrollItem, Selection, SelectionItem, Toggle and Value; every other pattern id returns `null` (`src/Windows/Avalonia.Win32.Automation/AutomationNode.cs:89-105`). Grid, GridItem, Table and TableItem are not mapped. The Win32 interop `IGridProvider`/`ITableProvider` declarations exist under `Interop/` but nothing implements or uses them. There is also no Avalonia-side Grid/Table provider interface (`src/Avalonia.Controls/Automation/Provider/` holds only 10 interfaces: ExpandCollapse, Invoke, RangeValue, SelectionItem, Selection, Toggle, Value, Scroll, Root, EmbeddedRoot). **[read]** No peer written in application code can make GridPattern/TablePattern appear, because the layer that answers UIA never asks for them.
- **Linux (AT-SPI): blocked for Table/TableCell, partially expressible otherwise.** The AT-SPI project (`src/Avalonia.FreeDesktop.AtSpi/`) ships interface definitions for Accessible, Action, Application, Cache, Collection, Component, EditableText, Event, Image, Selection, Text and Value only. There is no Table or TableCell definition or handler **[read]**. What an app *can* do: a custom peer can pick the role (`DataGrid` maps to `TreeTable`, `DataItem` to `TableCell`, `Table` to `Table`, `HeaderItem` to `ColumnHeader`; `AtSpiNode.RoleMapping.cs:44-59`), supply `Selected`/`Selectable` state via `ISelectionItemProvider`, and publish `posinset` and `setsize` object attributes from `AutomationProperties.PositionInSet/SizeOfSet` on the peer's owner control (`AtSpiNode.cs:173-181`) **[read]**. Those attributes are not table semantics (no row count, no column index) but a screen reader can read position-in-set from them.
- **macOS (NSAccessibility): blocked.** `native/Avalonia.Native/src/OSX/automation.mm` maps `DataGrid`/`Calendar` to the grid role, `Table` to the table role, `ListItem` to the row role, `DataItem`/`TreeItem` to the cell role, but I counted zero occurrences of `accessibilityRows`, `accessibilityColumns`, `accessibilityRowCount`, `accessibilityColumnCount`, `RowIndexRange`, `ColumnIndexRange` or `accessibilitySelectedRows`. **[read]** `PositionInSet`/`SizeOfSet` are not read by the native or managed macOS layer either **[agent-read, verified by grep of the clone only for the zero-hit counts above; the PositionInSet absence is as the agent reported, I did not grep it separately]**. Roles and expand/selected state are expressible; counts, indices and ranges are not.
- Net: **true table semantics (counts, row position, cell coordinates, real selection through a table interface) cannot be reached on any of the three OSes by application code alone on 12.1.5.** What is reachable: a table-like role names, per-row selected state through the standard selection-item pattern, and on Linux only, position-in-set attributes. Per the brief, this changes how the rest of the spike is spent: C2 and the T5 baseline are still done, C1 is limited to what the layers can actually express (selection state, set position on Linux, role), and the remaining time goes into a precise description of the upstream changes (T1 section 5) rather than prototypes that cannot work.

## T1. What Avalonia's accessibility layers can express

### T1.1 Provider interfaces and which peers implement them

Ten provider interfaces exist in `Avalonia.Automation.Provider` (`src/Avalonia.Controls/Automation/Provider/`): `IExpandCollapseProvider`, `IInvokeProvider`, `IRangeValueProvider`, `ISelectionItemProvider` (the file name contains a stray space), `ISelectionProvider`, `IToggleProvider`, `IValueProvider`, `IScrollProvider`, `IRootProvider`, `IEmbeddedRootProvider`. **[read]** (directory listing). There is no Grid, GridItem, Table, TableItem, Text, Window, Dock or Transform provider. **[read]**

Peers, from the agent report (declaration lines under `src/Avalonia.Controls/Automation/Peers/`) **[agent-read; I verified the mechanism below but did not re-open every peer file]**: `ItemsControlAutomationPeer` implements `IScrollProvider`; `SelectingItemsControlAutomationPeer` implements `ISelectionProvider`; `ListItemAutomationPeer` (used for `ListBoxItem` and `TabItem`; there is no class called ListBoxItemAutomationPeer) implements `ISelectionItemProvider`; `TreeViewItemAutomationPeer` adds `IExpandCollapseProvider`; Button/Toggle/ComboBox/Menu/TextBox/Range peers implement the obvious ones. The DataGrid is not in this repository: its peers live in the separate DataGrid package (see T3 for what ProDataGrid and stock peers implement).

Mechanism **[read]**: `AutomationPeer.GetProvider<T>()` calls the virtual `GetProviderCore(Type)`, whose default returns `this` when the peer class implements the interface (`AutomationPeer.cs:567, 696-699`, per the agent; the Windows node calls `Peer.GetProvider<T>()` as seen in the `GetPatternProvider` code I read). So a custom peer exposes a pattern by implementing the interface, but only the nine patterns in the Windows switch are ever consumed.

### T1.2 Windows (UIA)

See the early finding. **[read]** Patterns mapped: ExpandCollapse, Invoke, RangeValue, Scroll, ScrollItem (always), Selection, SelectionItem, Toggle, Value. Not mapped: Grid, GridItem, Table, TableItem (and Text, Window, Transform, Dock). `UiaPatternId.Grid/GridItem/Table/TableItem` exist in the enum (`IRawElementProviderSimple.cs:205-212`, per the agent) but are not in the switch.

**What a custom peer needs for Grid/Table to appear: nothing it can do.** The needed change is inside Avalonia (**[inferred]** design, sizes are estimates): (1) new public `IGridProvider`/`IGridItemProvider`/`ITableProvider`/`ITableItemProvider` interfaces in `Avalonia.Controls/Automation/Provider/` (about 4 small files); (2) a new `AutomationNode.Grid.cs` implementing the four UIA interfaces over them, modelled on `AutomationNode.Selection.cs`; (3) four new cases in the `GetPatternProvider` switch; (4) optional property-id mapping (`GetPropertyValue`, `s_propertyMap`) and the WinUI proxy mirror. About 150-300 lines, Windows only, plus the DataGrid package must then implement the interfaces (another ~150-250 lines, see the T4 estimate).

### T1.3 Linux (AT-SPI)

**[read]** Interfaces implemented: Accessible and Component (always), Application (root), Action (Invoke/Toggle/ExpandCollapse/Scroll/SelectionItem providers), Value (range), Selection (`ISelectionProvider`), Text/EditableText (value provider), Image, Cache. No Table or TableCell. A `AtSpiCollectionHandler` class exists but the agent found no registration for it **[agent, not verified]**. The backend is X11 only (hosted by `X11AtSpiAccessibility`); it is always on, with no options class to turn it off **[agent-read, not re-verified]**. Table/TableCell would be about 4 files and 300-500 lines (DBus XML, handlers, registration, row/column role mapping), Linux only **[inferred]**; note also that `DataGrid` is mapped to `TreeTable`, not `Table`.

### T1.4 macOS (NSAccessibility)

**[read]** (grep counts, role map lines above). Roles mapped for grid/table/row/cell; selected and expanded state implemented; none of the table attributes. Needed: new methods in `avn.idl` (regenerates COM bindings), the managed bridge `AvnAutomationPeer.cs`, and `automation.mm` (about 3 files, 200-350 lines plus a native rebuild) **[inferred size]**. This matches the open upstream issue Avalonia #22390 (T1.7).

### T1.5 What an app can do in application code vs what needs Avalonia

| Layer | In application code | Needs a change to Avalonia (size, platform) |
| ----- | ------------------- | ------------------------------------------- |
| Windows | role (ControlType), name, ISelectionItem/ISelection patterns, value, invoke | Grid/GridItem/Table/TableItem provider interfaces + node mapping: ~150-300 lines, Windows (+WinUI proxy) |
| Linux | role, name, state selected/selectable, `posinset`/`setsize` attributes via AutomationProperties on the owner control | AT-SPI Table + TableCell handlers: ~300-500 lines, 4 files, Linux. Plus the Avalonia-side provider interface shared with Windows |
| macOS | role, name, selected, expanded | accessibilityRows/Columns/RowCount/ColumnCount/IndexRange/SelectedRows/Index: ~200-350 lines, 3 files + native rebuild, macOS |

All sizes are **[inferred]** from the agents' reading and my own look at the same files.

### T1.6 Which AutomationProperties reach each tree, and why my earlier dumps did not show PositionInSet/SizeOfSet

`AutomationProperties` defines `PositionInSet` and `SizeOfSet` (defaults -1) but no general `Level` (only `HeadingLevel`) **[agent-read]**.

| Property | Windows | Linux | macOS |
| -------- | ------- | ----- | ----- |
| PositionInSet / SizeOfSet | not mapped (the UIA property ids exist in the enum but `GetPropertyValue` has no case; only the AT-SPI layer reads them) **[read]** | `posinset`/`setsize` object attributes, read from the peer's owner control **[read]** | not mapped **[read for absence of reads in automation.mm via the agent; verified zero-hit grep for the table methods only]** |
| HeadingLevel | mapped | `level` attribute / Heading role | AXHeading value |
| HelpText | mapped | Description | accessibilityHelp |
| ItemStatus / ItemType | ItemStatus mapped | not mapped | not mapped |
| IsRowHeader / IsColumnHeader | not mapped | not mapped | not mapped |

Why my earlier dumps did not show them:
- **Windows:** Avalonia does not return them (`GetPropertyValue` has no case) **[read]**. So the A1 fix's `PositionInSet`/`SizeOfSet` assignments were inert on Windows and macOS. The A1 fix wrote them anyway; that was wasted on those two OSes.
- **Linux:** the value *is* published as an object attribute, so it should have been visible, **but my `avalonia/tools/atspi_dump.py` never reads object attributes** (a grep for "attribute" in it finds nothing) **[measured: grep of my own tool]**. So the earlier statement that PositionInSet/SizeOfSet did not reach the tree was a gap in my dump, not necessarily in Avalonia on Linux. This is a **correction** to FOLLOWUP-RESULTS A1 (see Corrections below), pending a re-dump with the tool fixed (done in T4).

### T1.7 Upstream work in progress (as of 2026-11-12)

**[agent report; the unauthenticated GitHub API did not answer me, so these items are NOT independently re-verified. Listed as leads, not facts.]**
- DataGrid repo #267 "DataGrid rows and cells cannot be selected or invoked through UI automation": open, created 2026-10-23, author jeff377, no assignee, no comments seen. It says the row/cell peers implement neither `ISelectionItemProvider` nor `IInvokeProvider` (macOS, Avalonia 12.1.3, DataGrid 12.1.2).
- DataGrid repo PR #268 "Implement selection and invoke patterns for DataGrid rows and cells": open, opened 2026-10-28, same author; row peer gets `ISelectionItemProvider`, cell peer `IInvokeProvider`; grid-level `ISelectionProvider` deferred. Unassigned, no reviews seen.
- Avalonia #22390 "[macOS] ListBox and TreeView don't expose AXRows / AXSelectedRows": open, 2026-10-05, area-accessibility; closest item to macOS row/column work. PR #20733 "Implement accessibility for ListBox" was closed unmerged 2026-10-19.
- DataGrid #228 is a memory-growth bug (CJK/mixed data), not accessibility.
- Avalonia PR #15174 (merged 2024) added the current DataGrid peers: control types only. PR #5177 (merged 2022) was the original accessibility MVP.
- No issue or PR for UIA Grid/Table patterns, AT-SPI Table/TableCell, or macOS `accessibilityColumns` was found. Active accessibility contributors in Oct-Nov 2026 appear to be jmacato, grokys, jeff377 and ochoadan.

## T2. Licence of the DataGrid and its forks

Not legal advice. This is a reading of the texts below.

**How checked:** I re-ran the counts in the agent's clones (`/tmp/claude-0/t2/a/dg`, `/tmp/claude-0/t2/b/pro`) myself, and I took the Ms-PL text from the SPDX licence-list data (`spdx/license-list-data`, `text/MS-PL.txt`), because the agent quoted Ms-PL from memory with wrong section numbering; its numbering is not used.

1. **Stock DataGrid, tag `12.1.2` (`1e12211eb0c52a09e314ca57a344147c37d0a26c`) [measured]**: licence file `licence.md` = "The MIT License (MIT)", "Copyright (c) AvaloniaUI OÜ / All Rights Reserved"; `build/SharedVersion.props:12` `PackageLicenseExpression` = `MIT`. There is no NOTICE, THIRD-PARTY or Ms-PL file (only `licence.md`).
2. **Header notices, 74 `.cs`/`.axaml` files under `src/` [measured]:** 41 carry "Ms-PL / Microsoft Public License"; 40 carry "(c) Copyright Microsoft Corporation". The header (e.g. `DataGridLength.cs:1-4`) reads: "(c) Copyright Microsoft Corporation. This source is subject to the Microsoft Public License (Ms-PL). Please see http://go.microsoft.com/fwlink/?LinkID=131993 for details. All other rights reserved." 33 files carry no notice. Apache headers: 0 (agent). So the package declares MIT while 41 of 74 source files say they are under Ms-PL; the repo does not mention Ms-PL anywhere outside those headers. The readme only says the control "was initially ported from Silverlight" **[agent-read]**. Whether Ms-PL files can be relicensed MIT by a wrapper is a question I cannot answer; my reading is that the file-level notice stays attached to the file.
3. **ProDataGrid, tag `v12.1.5` [measured counts]:** `licence.md` MIT (Wiesław Šoltés), `licence-avalonia.md` MIT (AvaloniaUI OÜ); 101 files carry Ms-PL text, 70 carry a Microsoft copyright. Same mix as the stock control (it is a fork). No other maintained MIT fork was searched for **[not measured]**.
4. **Conditions, quoting the Ms-PL text I fetched (SPDX):**
   - 3(C): "If you distribute any portion of the software, you must retain all copyright, patent, trademark, and attribution notices that are present in the software."
   - 3(D): "If you distribute any portion of the software in source code form, you may do so only under this license by including a complete copy of this license with your distribution. If you distribute any portion of the software in compiled or object code form, you may only do so under a license that complies with this license."
   - 2(A): the copyright grant is "to reproduce its contribution, prepare derivative works of its contribution, and distribute its contribution or any derivative works that you create", subject to section 3.
   - 3(A): "This license does not grant you rights to use any contributors' name, logo, or trademarks." 3(B): suing a contributor over patents ends your patent licence from them. 3(E): as-is, no warranty.
   - MIT (`licence.md`): permission "to use, copy, modify, merge, publish, distribute, sublicense, and/or sell"; condition "The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software."
   
   **Plain-words reading [inferred]:** copying a DataGrid file into our repo and modifying it is permitted. A file with a Microsoft/Ms-PL header must keep that header (3(C)). If we ever give out the *source* of such a file, it must go out under Ms-PL with a copy of the licence (3(D)); that is reciprocal for those files only, not for the rest of the app. A compiled app may be distributed "under a license that complies with this license" (3(D)): the usual reading is that a closed binary is fine as long as the binary licence does not take away Ms-PL rights, but the sentence is ambiguous and is where a lawyer should look. MIT-only files need their copyright and permission notice kept. In practice: ship a third-party notices file listing MIT (AvaloniaUI OÜ, and Šoltés if ProDataGrid is used) and Ms-PL (Microsoft), keep headers intact, and do not use Microsoft's name.
   
   This matters beyond copying: **referencing the unmodified NuGet package already ships those Ms-PL-derived files in binary form**, so the notice duty applies to the current stack too (C0 and A6 are affected, not only a forked table). **[inferred]**

## T3. Candidate tables: research parts (ProDataGrid)

**How checked:** the agent's maintenance and nuspec numbers are **[agent, not verified]** except what I re-ran myself: the clone's latest tag is `v12.1.5` and the licence counts above. Hands-on facts (does it build against 12.1.5, what does its peer expose) come from T4 and are reported there.

- **Maintenance [agent, not verified]:** last commit 2026-11-06 ("Update Avalonia to 12.1.5"); latest tag `v12.1.5` on the same day; about 10 stable releases in 7 months with a gap of about 2.5 months (April-June); roughly 1,407 commits in 12 months by 9 authors, of which the owner (Wiesław Šoltés) wrote about 98.9%; 19 open issues, 0 open PRs; `FUNDING.yml` lists GitHub Sponsors. Effectively a single-maintainer project; the commit volume (250-315 per month) suggests heavy automation or AI assistance, which is inferred, not known.
- **Avalonia target [agent, not verified; will be confirmed by building in T4]:** package id `ProDataGrid`, TFMs net8.0 and net10.0, depends on Avalonia 12.1.5 plus two sibling packages from the same repo (`ProDataGrid.FormulaEngine`, `.Excel`). MIT; no paid component found by the agent.
- **Accessibility [agent-read; I will re-open the peer files in T4]:** the docs have no accessibility section. The automation peers (`src/Avalonia.Controls.DataGrid/Automation/Peers/`) implement `ISelectionProvider` on the grid and `ISelectionItemProvider` + `IExpandCollapseProvider` on rows (including a placeholder peer for unrealized selected rows); cells and headers are plain peers; the agent found no Grid/Table providers and no PositionInSet/SizeOfSet use. That is expected, since Avalonia has no such interfaces (T1).
- **API [agent-read]:** same namespace (`Avalonia.Controls`) and control name (`DataGrid`), same column classes; migration is a package swap (`Avalonia.Controls.DataGrid` to `ProDataGrid`) plus the v2 theme include; extra features (sorting/selection models, formula columns) are opt-in.

## Corrections to earlier results (running list)

1. FOLLOWUP-RESULTS A1/F3: "`PositionInSet`/`SizeOfSet` did not reach the tree" is incomplete. On Windows and macOS Avalonia does not map them at all (so the A1 fix was inert there); on Linux Avalonia publishes them as `posinset`/`setsize` attributes, and my `atspi_dump.py` did not print object attributes, so the Linux conclusion was unproven. To be re-checked in T4 with the tool fixed.
2. FOLLOWUP-RESULTS A6 licence facts: not covered before. The stock DataGrid package declares MIT but 41 of 74 source files carry Microsoft Ms-PL headers (T2).


3. FOLLOWUP-RESULTS F1, Windows: the F1 memory numbers (private working set 62 / 87 / 75 MB at P0 / P3 / P5) were taken **without** the A1 fix. With the same fix flags used for every candidate here, the stock DataGrid on Windows measured 148.7 MB at P2 and 149.2 MB at P3 (repeat run: 148.1 / 148.9). That is not a correction of the F1 number for the original app, but the F1 table should not be read as the cost of an accessible stock grid. Cause not established (see T4.2).
4. FOLLOWUP-RESULTS A1: "the row peer has no selected state" is true of the stock peers **[measured: no SelectionItem pattern on stock rows on Windows, no selectable/selected state on Linux]**, but it is not true of the DataGrid family: ProDataGrid's peers expose real selected state on all three OSes (C3 below).

## T4. Prototypes and measurements

All four candidates render the same Transactions page (10,000 rows, own sorting, selection, side panel) from one code base, selected with `--table` and, for C3, a build flag. Every candidate was run with `--a11y-fix`, which keeps the page content out of the navigation view and sets `PositionInSet`/`SizeOfSet` on rows. CI: commit `56cf5b2` (Linux; Windows and macOS repeated from commit `b687558`), `ubuntu-24.04` / `windows-latest` / `macos-latest`, one run per cell unless stated. Raw files: `avalonia/evidence/table-a11y/`.

| | What it is | Code | Left out |
| - | - | - | - |
| C0 | stock DataGrid 12.1.2 + the A1 fix (row name and position set from app code) | already existed | n/a |
| C1 | `DataGrid` subclass whose grid peer returns its own row peers (`ISelectionProvider` on the grid, `ISelectionItemProvider` on rows, row name, row control type chosen per OS) | about 61 lines in `Slice/Tables.cs` | cell peers, header peer behaviour (see below), unrealized-row placeholders |
| C2 | button header row + virtualized `ListBox` with templated rows | about 68 lines | column resize/reorder, clipboard, column fit; header and row columns are about 14 px out of line because of `ListBoxItem` padding (left as is) |
| C3 | ProDataGrid 12.1.5 swapped in for the stock package (`-p:DataGridImpl=pro`), same page code | about 15 lines (package switch, theme path, `#if`) | nothing; C1's peers are compiled out |

**Why C1 is built the way it is [measured/read]:** the grid creates its rows internally with `new DataGridRow()` (`DataGridRows.cs:1031` in the DataGrid repo, tag 12.1.2), so rows cannot be subclassed and the stock row peer cannot be replaced; the only app-code route is to return wrapper peers from the grid peer's `GetChildrenCore`. That works but reshapes the tree (rows become direct children of the grid; the stock header/scroll wrappers are bypassed) and depends on child-list invalidation (see the findings below).

### T4.1 Accessibility, per OS (measured; dumps from the running app, not from code)

Legend: "real selected" = the platform's own selected state on the row, not text in the name.

**Linux (AT-SPI)**

| | table role | Table interface / counts | rows: position / set size | real selected | container Selection iface | cell coordinates | after scrolling to the end |
| - | - | - | - | - | - | - | - |
| C0 | `tree table` | none | `posinset`/`setsize` attributes present (1.. / 10000) | **no** (name ends ", selected") | no | none | tree still shows rows 1 to 12 |
| C1 | `tree table` | none | present (1.. / 10000) | **yes** (`selectable`, `selected`) | yes | none | stale, as C0; header node missing from the children |
| C2 | `list` | none | present | **yes** | yes | none | stale |
| C3 | `tree table` | none | present | **yes** | yes | none | stale |

- Rows are reported with role `table cell` (C0, C1, C3) or `list item` (C2). Cells inside rows are plain panels/labels. No candidate has a Table or TableCell interface: those do not exist in Avalonia's AT-SPI layer (T1).
- The `posinset`/`setsize` attributes **do** reach the tree on Linux (correction 1). This needed my dump tool to print object attributes, which it did not before.
- The tree after scrolling still lists the rows from the top (zero rows with 2026-12 dates in any of the four dumps taken 2 s after `scrollEnd`), while the screenshot shows the last rows. So on Linux the table's children are not refreshed after a scroll in any candidate, including the stock one. I did not establish why. Avalonia issue #22583 / PR #22585 (T1.7, agent-reported, not re-verified) describes a similar symptom for rows added to a ListBox.
- The dump takes the first 12 children of each node, so "rows found: 12" is the dump limit, not the realized count; realized rows were about 18 to 22 (child counts).

**Windows (UI Automation)**

| | control type | Grid / Table / GridItem pattern | Selection (container) | row SelectionItem, real selected | PositionInSet / SizeOfSet | headers | cells |
| - | - | - | - | - | - | - | - |
| C0 | DataGrid | **none** | none | **none** (rows have only ScrollItem; name text says ", selected") | not shown | `Header` + `HeaderItem` "Date ▲" | `DataGridCell`, control type Custom, one per column |
| C1 | DataGrid | **none** | yes | **yes** (`SELECTED=True/False`) | not shown | present in the later dump | not seen under the wrapper rows in my dump |
| C2 | List | **none** | yes (+ Scroll) | **yes** | not shown | buttons (not captured in my filter) | TextBlocks |
| C3 | DataGrid | **none** | yes | **yes** | not shown | `Header` + `HeaderItem` | `DataGridCell` |

- No Grid, Table or GridItem pattern appears for any candidate, and no row or column count (the source confirms the node cannot offer them, T1.2).
- `PositionInSet`/`SizeOfSet` are not in the Windows dumps. Source says Avalonia does not map them. My dump reads them through the managed client by raw property id; if that call silently returns nothing for ids the managed client does not know, the dump alone would not show them, but the source reading agrees with the dump **[read + measured]**.
- C1 first dump (selected state, taken a few seconds after navigation) showed the grid with **no children** and the later dump showed 12 rows. So C1's child list was stale at first read. On Linux C1 shows rows but not the header. C1 is fragile in exactly the way a wrapper-peer hack would be.
- After scrolling to the end, the Windows trees did update (rows dated 2026-12-31 appear), unlike Linux.

**macOS (AX)**

| | container role | AXRows / AXSelectedRows / AXColumns / row count | row role | real selected (`AXSelected`) | position / index | cell coordinates |
| - | - | - | - | - | - | - |
| C0 | `AXGrid` | attributes absent; `AXRowCount=0` | `AXCell` | no (`selected=0` for the selected row; name text only) | `AXIndex=0` everywhere | none |
| C1 | `AXGrid` | absent | `AXRow` | **yes** (`selected=1`) | none | none |
| C2 | `AXList` / content list | absent | `AXRow` | **yes** | none | none |
| C3 | `AXGrid` | absent | `AXCell` | **yes** | none | none |

After scrolling, the macOS trees update (rows dated 2026-12-31 listed). C1 on macOS maps rows to `AXRow` because my peer picks `ListItem` there, which the layer maps to the row role; that is the one place app code can influence the macOS role.

**Summary of what reaches the platforms in application code (all candidates)**

| semantic | Linux | Windows | macOS |
| - | - | - | - |
| table/grid role | yes for C0/C1/C3 (`tree table`), no for C2 | yes (DataGrid type) for C0/C1/C3, no for C2 | yes (`AXGrid`) for C0/C1/C3, no for C2 |
| total row/column counts | **no** (only `setsize` on each row) | **no** | **no** |
| row position | **yes** (attribute) | **no** | **no** |
| real selected state on rows | C1, C2, C3 yes; C0 no | C1, C2, C3 yes; C0 no | C1, C2, C3 yes; C0 no |
| cell coordinates | **no** | **no** | **no** |

### T4.2 G2 numbers (same CI runners as before)

Scroll: whole grid scrolled twice (frame-to-frame times), worst frame in ms, run 1 / run 2. Sort: slowest of the 10 sorts (5 columns x 2 directions), compute and assign / to a rendered frame.

| | Linux worst frame | Linux slowest sort (compute / to frame) | Windows worst frame | Windows slowest sort | macOS worst frame | macOS slowest sort |
| - | - | - | - | - | - | - |
| C0 | 45.1 / 20.1 | 36.3 / 86.6 | 63.5 / 47.9 | 18.1 / 73.8 | 151.9 / 79.2 | 23.2 / 137 |
| C1 | 64.8 / 33.0 | 36.1 / 129 | 61.2 / 62.0 | 21.2 / 67.2 | 53.2 / 80.1 | 15.3 / 124.7 |
| C2 | 60.8 / 34.9 | 18.5 / 45.3 | 108.5 / 47.9 | 21.4 / 30.0 | 166.4 / 81.9 | 21.6 / 116.6 |
| C3 | 105.4 / 33.7 | 70.9 / 184 | 95.2 / 47.2 | 41.5 / 87.7 | 249.6 / 74.7 | 43.0 / 201.5 |

Frames over 100 ms (run 1 / run 2): Linux none except C3 (1 in run 1); Windows C2 1 (run 1), others none; macOS C0 1, C2 4, C3 3 in run 1, none in run 2. The first scroll pass is the worse one on every candidate that has outliers. These are single runs on shared runners, not repeated, so differences of tens of milliseconds are not distinguishable from noise. Against the G2 rule in SLICE-SPEC ("no frame over 100 ms while scrolling the whole grid"; sorting under 500 ms), run 1 had frames over 100 ms in these cells only: Linux C3 (105.4 ms), Windows C2 (108.5 ms), macOS C0 (151.9 ms), macOS C2 (166.4 ms) and macOS C3 (249.6 ms); every other cell, and every second pass, was under 100 ms. Every sort in every cell was under 500 ms (slowest 201.5 ms). Whether those outliers are the candidate or the runner I cannot say from one run.

Memory, same per-OS metric as F1 (Linux PSS MB; Windows private working set MB; macOS footprint MB):

| | Linux P2 / P3 / P5 | Windows P2 / P3 / P5 | macOS P2 / P3 / P5 |
| - | - | - | - |
| C0 | 214.8 / 217.3 / 263.8 | **148.7 / 149.2 / 147.0** | 180 / 181 / 184 |
| C1 | 214.9 / 220.5 / 256.3 | 94.4 / 94.4 / 87.0 | 178 / 139 / 162 |
| C2 | 209.8 / 207.7 / 255.9 | 79.8 / 80.4 / 59.1 | 176 / 176 / 145 |
| C3 | 226.5 / 232.6 / 279.2 | 89.5 / 89.1 / 87.4 | 194 / 194 / 193 |

All are far below the 400 MB bound used earlier. The standout is stock C0 on Windows, repeated twice (148.7 and 148.1 MB at P2), against about 90 MB for C1 and C3, which use the same page code, and 87 MB at P3 for the original app without the fix (F1). I did not find the cause and did not probe it (no tuning, per the rules); because C3 runs the identical fix code with a different package and is lower, the package rather than the fix code is the differing factor. The macOS C1 footprint drop between P2 and P3 (178 to 139 MB) is another unexplained single-run observation.

Behaviour scenario (44 checks on Linux, 43 on Windows and macOS; real OS keys on Linux and Windows): **all four candidates pass all checks on Linux (44/44) and Windows (43/43)**; on macOS all four fail the same 3 synthetic-key checks as before (Tab to a legend row, Tab in the dialog, Escape). That scenario does not test arrow-key navigation inside the table with a screen reader.

Cold start (wall ms, first run): Linux C0 903, C1 1668, C2 1103, C3 1720; Windows 1721 / 2095 / 2248 / 2472; macOS 1864 / 1118 / 2411 / 3644. Single runs, noisy.

### T4.3 Effort

- **Active time:** I did not time it precisely. My estimate is about 2.5 to 3 hours of hands-on work for T4 (abstraction refactor, C1, C2, C3 switch, dump tool changes, workflows, two CI rounds, result reading), plus waiting on CI. **[inferred]**
- **Code:** a shared `TableHost` abstraction (about 35 lines) plus the candidate code in the table above.
- **Not finished:** C1 cell peers and header behaviour (header missing from the Linux child list, first-read empty on Windows); anything for the Linux stale-after-scroll behaviour; a ProDataGrid theme check beyond a screenshot (its v2 theme renders smaller rows and unstyled headers compared with the stock theme).
- **Estimates to production quality** (sorting, column resizing, keyboard behaviour, text measurement for mixed scripts, clipboard, light/dark theming, tests). These are my guesses, **[inferred]**, as person-weeks for one developer who already knows Avalonia:
  - **C0 / C1 (stock DataGrid plus app-side peers):** 2 to 4 weeks to make the wrapper-peer approach robust (child invalidation, header, cell peers, unrealized rows, selection notifications, tests on three OSes), because the stock grid already supplies sorting, resizing, text measurement and clipboard. It still cannot report table semantics (T1), so this reaches "named rows with real selection", not the target.
  - **C2 (ListBox table):** 4 to 7 weeks. Header alignment, column resizing/reordering, per-column alignment, clipboard, column fit for mixed scripts, keyboard (Home/End/Page already work), light/dark theming and tests are all hand work; accessibility-wise it behaves best with NVDA (T5) but still has no counts or cells.
  - **C3 (ProDataGrid):** 1 to 2 weeks to adopt (it built and ran against 12.1.5 with about 15 lines of change, the full test pass and visual tuning of its v2 theme remain), but the same accessibility gaps as stock apply (NVDA silent on arrows, T5) and the dependency is effectively one maintainer (T3, agent-reported).
  - **Upstream route** (to give any DataGrid candidate real table semantics): about 1000 to 1400 lines across Windows (150 to 300), AT-SPI (300 to 500), macOS (200 to 350 plus a native rebuild) and the DataGrid peers (150 to 250); 3 to 6 weeks for a developer new to those layers, and it means shipping a forked Avalonia (the macOS part is in the native library). **[inferred from T1 sizes]**

## T5. Real screen reader (time-boxed)

Tool: Guidepup **0.40.0, MIT, published 2026-11-01** (setup 0.29.3, MIT, 2026-10-14) **[measured: npm registry]**; same scenario as the Electron slice's run (focus the grid, ArrowDown, End, open the dialog, Tab, Escape), NVDA on `windows-2025`, two runs of about 40 s per candidate (the 2nd with a fixed focus step and an explicit "report focus" step). The check is crude: one run per candidate, 1.5 s wait after each key, no human listening, phrases taken from NVDA's spoken-phrase log.

Run 1 caveat: my "focus the table" step did not move keyboard focus for the ListBox candidate (arrows went to the navigation list: "Overview, not selected", "Transactions"...). That run is therefore not valid for C2; I fixed the step (focus the selected or first row) and re-ran. For the DataGrid candidates the second run confirms focus was on the grid.

Run 2, raw (exactly what NVDA's log recorded):

| step | C0 stock + fix | C1 custom peers | C2 ListBox | C3 ProDataGrid |
| - | - | - | - | - |
| report focus | "Transactions table, data grid, focused" | same | "2026-01-01, Aeroflot Аэрофлот number 4389, Travel Mastercard, Flights and hotels, minus $135.41, list item, focused" | same as C0 |
| ArrowDown 1 to 4 | **empty phrase each time (nothing spoken)** | empty | "2026-01-01, Air Canada, Rewards Visa, Flights and hotels, minus $480.98", then the next three rows, each by name | empty |
| End | empty | empty | "2026-12-31, 珈琲館 number 1223, Everyday Chequing, Coffee, minus $4.79" (last row) | empty |
| open the Settings dialog | nothing announced | nothing | nothing | nothing |
| Tab in the dialog | "edit, Optional reason" | same | same | same |

- **No candidate had NVDA announce "selected", a row or column number, "row 3 of 10,000", or a column name.** C2 reads each full row (date, description, account, category, amount) as one phrase, row by row, which is the closest to a usable result; the three DataGrid-based candidates are silent when the arrow keys move the selection (the grid element keeps the focus; the rows are not focus targets) **[measured; the reason is inferred]**. C1's extra patterns (real selected state) did not change what NVDA says, and C3's richer peers did not either.
- The dialog: opening it is not announced in any candidate (same as the Electron run, which also announced nothing on open), and Tab inside it reads "edit, Optional reason" correctly.
- **VoiceOver on `macos-latest`: could not be started** ("VoiceOver cannot be started"), same as the Electron session **[measured]**. Orca on Linux: not run **[not measured]**.
- Comparison with the Electron run (its FOLLOWUP-RESULTS F3 stretch): there NVDA treated the grid as a table, read "row 2, Description, column 2, Aeroflot..." and moved cell by cell, with no "selected". So Electron's grid gives table vocabulary (row and column numbers) but a different navigation model from the app's own; Avalonia's ListBox table gives a clean row-by-row reading without numbers; Avalonia's DataGrid candidates give nothing on arrows.

## T6. The decision

**1. Is true table semantics (counts, position, real selection, cell coordinates) achievable in application code on Avalonia 12.1.5? No, on any of the three OSes.** What application code *can* reach: a grid/table role name, real selected state on rows through the selection patterns (C1, C2, C3 all do it), row names, and on Linux only the position and set size of each row as attributes. Blocked, and the exact change in Avalonia that would unblock each (sizes from T1, **[inferred]**):
- **Windows:** no Grid/GridItem/Table/TableItem patterns, no row or column counts, no cell coordinates, no `PositionInSet`/`SizeOfSet`. Needs new public provider interfaces plus a UIA node implementation and the four new `GetPatternProvider` cases (`AutomationNode.cs:89-105`): about 150 to 300 lines, Windows only.
- **Linux:** no Table/TableCell interfaces. Needs the DBus interface definitions and two handlers plus `TableRow` role mapping: about 300 to 500 lines in 4 files, Linux only; plus the shared provider interface above.
- **macOS:** no `accessibilityRows/Columns/RowCount/ColumnCount/RowIndexRange/ColumnIndexRange/SelectedRows`. Needs new members in the COM interface, the managed bridge and `automation.mm`: about 200 to 350 lines and a native rebuild.
- In all three cases the DataGrid package would also need peers that implement the new interfaces (150 to 250 lines). Upstream, only DataGrid selection/invoke patterns (#267, PR #268) and macOS ListBox/TreeView rows (#22390) are in flight, and none has an owner (T1.7, agent-reported, not re-verified); I found nothing in flight for Grid/Table patterns.

**2. Comparison (single runs; "no" means not present in my dumps):**

| | C0 stock + fix | C1 custom peers | C2 ListBox table | C3 ProDataGrid |
| - | - | - | - | - |
| Linux: role / counts / row position / real selected / cell coords | tree table / no / yes (attr) / **no** / no | tree table / no / yes / yes / no | list / no / yes / yes / no | tree table / no / yes / yes / no |
| Windows: role / counts / row position / real selected / cell coords | DataGrid / no / no / **no** / no | DataGrid / no / no / yes / no | List / no / no / yes / no | DataGrid / no / no / yes / no |
| macOS: role / counts / row position / real selected / cell coords | AXGrid / no / no / **no** / no | AXGrid / no / no / yes / no | AXList / no / no / yes / no | AXGrid / no / no / yes / no |
| NVDA, arrows | silent | silent | row by row, full text, no "selected", no numbers | silent |
| G2 worst frame (Linux / Win / mac, run 1) | 45 / 64 / 152 | 65 / 61 / 53 | 61 / 109 / 166 | 105 / 95 / 250 |
| Memory P3 (Linux PSS / Win private / mac footprint, MB) | 217 / 149 / 181 | 221 / 94 / 139 | 208 / 80 / 176 | 233 / 89 / 194 |
| Effort to adopt, then to production | done / 2 to 4 wk | about 1 day built / 2 to 4 wk | built / 4 to 7 wk | about 1 day / 1 to 2 wk to adopt |
| Licence | MIT package, 41 of 74 source files carry Ms-PL headers (notice duties apply to shipped binaries) | same | none (our code) | MIT package, 101 files with Ms-PL notices, plus MIT notice for the Avalonia fork |
| Maintenance risk | upstream DataGrid: 163 open issues, "not accepting new features" (A6) | same, plus a peer hack that depends on private tree behaviour | highest ownership cost, no external dependency | one maintainer per the agent's count (98.9% of 1,407 commits, **not verified by me**), very active |

**3. Recommended path, effort, and the largest risk.** On the evidence, no Avalonia candidate reaches an accessible table that Folio could ship by application code alone. My recommendation: if Avalonia is chosen, build on **C2 (ListBox rows)**, because it is the only candidate where NVDA reads each transaction fully, row by row, and it has real selected state on all three OSes; budget **4 to 7 person-weeks** to reach production quality for the table itself **[inferred]**, and accept for the first release that screen reader users get row-by-row reading without total counts, positions (except on Linux) or column vocabulary. Closing that gap needs the upstream changes in section 1 (3 to 6 further weeks, with a forked Avalonia, and an ongoing merge burden), or waiting for upstream. The largest remaining risk is that accessibility semantics beyond the row level are not in Avalonia's platform layers and nobody upstream is working on them; the second is the Linux tree not refreshing after a scroll (measured on all four candidates). For comparison, Electron's grid reports the true table size on Windows only (10,001 via GridPattern); on Linux the AT-SPI Table interface reports 30 and on macOS only the rendered rows; its NVDA run moved cell by cell with row and column numbers and no "selected"; it falls short of what Folio wants on counts outside Windows and on the screen reader moving through the grid by cell rather than by row. So neither stack delivers all of: counts, position, selected state and a good row-level reading on every OS, but Electron provides more of the vocabulary today and Avalonia provides more control and a cleaner row reading.

**4. What this spike shows was wrong earlier:** (a) the FOLLOWUP-RESULTS statement that `PositionInSet`/`SizeOfSet` did not reach the tree: they reach Linux (attributes) and not Windows or macOS, and the earlier dump tool could not show them (Corrections 1); (b) the Windows memory numbers for F1 are for the app without the A1 fix, not for an accessible stock grid (Correction 3); (c) "the DataGrid row peer has no selected state" is a property of the stock package only (Correction 4); (d) the earlier A1 fix set `PositionInSet`/`SizeOfSet` for platforms that ignore them, so it only helped Linux.

## Not measured / open

- A real screen reader on Linux (Orca) or macOS (VoiceOver could not start).
- NVDA runs are single, crude, un-listened phrase logs; no JAWS or Narrator.
- Why stock-grid memory on Windows is about 60 MB higher than the other candidates with the same code; why Linux trees go stale after a scroll; why C1's header is missing on Linux and its first Windows read is empty.
- Copying DataGrid source into the repo and giving it real row and cell peers (not needed for this spike; would need the Ms-PL notices in T2).
- ProDataGrid: its full theme, features and maintainer facts beyond what the nuspec and the build showed; the agent-reported maintenance numbers.
- The agent-reported upstream issues and PRs in T1.7 were not independently re-opened (the unauthenticated GitHub API did not answer).
