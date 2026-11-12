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

(The remaining sections T4, T5 and T6 follow below as they are completed.)
