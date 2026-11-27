---
section: '09.04'
title: 'Package layout, UI and layouts'
lifecycle: draft
tags: [decisions, ui, layout]
key_files:
  - .dependency-cruiser.cjs
  - packages/renderer/src/ui/fluent/app-root.tsx
  - packages/renderer/src/layout/resolve-layout.ts
  - packages/renderer/src/layout/layout-registry.ts
  - packages/renderer/src/app/layout-context.tsx
---

> Decisions AD-13, AD-14, AD-15, AD-21. The list of all decisions is in [09_architecture_decisions.md](09_architecture_decisions.md).

## AD-13. Charts are ECharts behind chart models

_Decision._ The four chart types (donut, stacked bar, column bars, diverging bars) are drawn with ECharts (Apache-2.0, SVG renderer). A chart model feeds each chart with series data, colours taken from the design tokens, and click events for drill-down (A1.6). Rendering is replaceable without touching the chart models.

- Every chart has a keyboard-reachable equivalent: legend rows are real buttons that open the matching transactions, and the same numbers appear in a table beside the chart.
- ECharts' own generated accessibility label read raw integer cents in the selection slice, so it stays off in favour of our own label.
- The build tree-shakes ECharts, so each component the charts use (title, legend, tooltip and so on) is registered explicitly.
- Money reaches ECharts as integer cents and is formatted from integers, never through a float.

_More chart types are available._ ECharts has about twenty built-in series types, including line, bar, pie and donut, scatter, heatmap, candlestick, radar, funnel, gauge, treemap, sunburst, sankey and calendar. The [example gallery](https://echarts.apache.org/examples/en/index.html) shows them all with their source, and the [feature overview](https://echarts.apache.org/en/feature.html) lists the types. The net worth history (N1.7) and category trends are natural line or area charts. Adding a type means adding a chart model and a legend or table equivalent, not changing the rest.

_Alternatives kept in reserve_ (all MIT or ISC): Recharts, visx, Chart.js, Observable Plot. ECharts releases slowly (one release in six months at the 2026-11-12 check), which the chart-model boundary makes tolerable.

## AD-14. Package layout, UI state and testing

_Decision._ The repository is a workspace of packages (the scaffold plan names the tooling): `core` (all domain logic, never imports Node, the DOM, React or Electron), `host-api` (the interfaces from AD-19 and a mock), `renderer` (React screens, chart models, app components), and the `desktop` app that holds the Electron main process. A read-only `web` app comes later. Layers inside `core` are folders (`domain`, `commands`, `persistence` and so on), not extra packages.

UI state lives in a core store that components read through `useSyncExternalStore`. Components stay thin: when logic needs more than a trivial test, it belongs in `core` or in a small pure module in the renderer, and is unit tested.

Tests come in four kinds, each runnable on its own. The most expensive resource a test touches decides its kind, not how much code it covers.

| Kind         | Rule                                                                                                                                                                                                                         | Where                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Unit         | One process, deterministic. No real file system, network, Electron or browser engine; time comes from the injected `Clock`. A simulated DOM is allowed for component tests; several real modules may work together in memory | `*.test.ts` next to the code (`*.test.tsx` for component tests), run by Vitest |
| Integration  | One machine: real temporary folders, the real host adapter, a real browser engine for the renderer, loopback                                                                                                                 | `tests/integration/`, Vitest                                                   |
| Architecture | Structural rules of the codebase itself (fitness functions): package boundaries, where Fluent may appear, test placement and naming                                                                                          | `tests/architecture/`, dependency-cruiser and Vitest                           |
| End-to-end   | The packaged app on a real OS window, driven by Playwright (AD-16)                                                                                                                                                           | `tests/e2e/`, Playwright                                                       |

- _Techniques are not kinds._ Property-based tests (fast-check), snapshot tests and committed sample `.folio` files (format-compatibility checks) go in whichever kind their resources put them in, usually unit. Product rules such as "a locked month never changes" are ordinary unit or integration tests.
- _Why unit tests sit next to the code._ The ai-foundation JavaScript standard colocates tests. A test is easy to find, and moves or is deleted with the module it covers, and imports stay short. The cost is a rule that keeps test files out of builds and packages, and an architecture check that keeps them from importing the wrong things. The other kinds live under `tests/<kind>/` because they span packages or need a real environment. A mirrored `tests/unit/` tree is equally workable: it keeps every kind in one place, at the price of longer paths and two trees that can drift apart.
- _Enforcement._ dependency-cruiser rules check that `core` imports nothing from Node, the DOM, React or Electron; that the renderer never imports Electron or Node; that the main process never imports React; that Fluent UI is imported only under `renderer/src/ui/fluent/`; and that unit tests import neither Electron nor Playwright. An architecture test checks that each test file sits in the right place and that tests follow the three-level naming shape (`describe` the subject, `describe` the condition, `it` the expected result). The rest of the unit rule (no real file system or network) is a review check. CI runs architecture tests first because they are the cheapest.
- _Later options._ Tagging tests within a kind (slow, visual or quarantined) is left open and not set up. Performance and stress testing are a separate initiative; they may use this setup.

_Consequences._ One language across domain, UI, host and tests, which is what lets the same core run in the desktop app, a Node tool and a browser.

## AD-15. The design system is Fluent UI React v9 behind app components

_Context._ Fluent UI React v9 matches the prototype's look, is maintained by Microsoft (908 commits by 65 authors in the 12 months to November 2026) and ships the components the design needs. A design system still changes faster than a domain, and replaceable presentation is a quality goal.

_Decision._ Use `@fluentui/react-components` v9 with its light and dark themes and the brand ramp set around the prototype's accent (#0078D4), and contain it:

1. Screens use colours, spacing and type only through Fluent tokens, never hard-coded values (for example text-primary is `tokens.colorNeutralForeground1`, card-bg `tokens.colorNeutralBackground1` with a `tokens.colorNeutralStroke2` border, divider `tokens.colorNeutralStroke2`; the exact names are verified against the pinned version). App tokens exist only where the prototype adds its own, such as the status backgrounds.
2. One theme module sets the themes, the accent and the app tokens, and follows the system theme unless the user chose light or dark (H1.9). Styles never go on `FluentProvider` itself: Fluent copies a provider's class name onto the portal element that holds menus and dropdown lists, so a full-height background there covers the page and swallows every click. For the same reason a style hook must not run in the component that renders the style provider: it would use the default style engine, whose style elements carry no CSP nonce (AD-18) and are blocked.
3. Fluent components reach screens through app components under `renderer/src/ui/fluent/`: the shell, dialogs, banners, icons, tables and form controls. Screens import those, not Fluent.
4. No Fluent import appears outside `renderer/src/ui/fluent/`. An architecture test enforces this.
5. Charts read colours from the same tokens and redraw on theme change.

_Component mapping._ The prototype's controls map to Fluent UI React v9 components as follows.

| Prototype                                                       | Fluent UI React v9                                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| NavigationView                                                  | `NavDrawer` with nav items and a footer item                                                         |
| Button (standard, accent)                                       | `Button`, `appearance="primary"` for the primary action                                              |
| ComboBox (month, filters, provider)                             | `Dropdown`, or `Combobox` where typing helps                                                         |
| TextBox (search, notes, forms)                                  | `Input`, `Textarea`                                                                                  |
| ToggleSwitch (Full pass, month-end analysis, auto-open)         | `Switch`                                                                                             |
| ToggleButton (tabs and segment choices)                         | `ToggleButton`, or `TabList` where it is a real tab                                                  |
| InfoBar (status banners, toasts, warnings)                      | `MessageBar`                                                                                         |
| Dialogs (new file, import, reopen confirmation)                 | `Dialog`                                                                                             |
| Cards, tiles                                                    | `Card`, or a container styled with card tokens                                                       |
| Tables                                                          | Fluent `Table` markup with TanStack Virtual (Transactions, Accounts, close balances, import preview) |
| Charts (donuts, money in vs out, category bars, net worth bars) | ECharts behind chart models (AD-13)                                                                  |

_Tables._ Fluent's `Table` supplies the markup and TanStack Virtual (MIT, founder-led) supplies row virtualization for the 10,000-row grids; sorting, selection and the side details panel are ours. Editing happens in side panels, not in cells. The grid exposes `grid`, `row`, `gridcell` and `columnheader` roles with `aria-rowcount`, `aria-rowindex`, `aria-selected` and `aria-sort`; the focusable element is the scroll container and arrow keys move row selection. That is not a fully compliant ARIA grid. Screen-reader polish is a later initiative, and until then rows have accessible names and every control has a stable `data-testid` for test tooling.

_Revisit when_ a design review prefers another system, or Fluent UI's maintenance changes. The change stays inside `renderer/src/ui/fluent/`.

## AD-21. Layouts are chosen by form-factor profile and width class

_Context._ The app must look right at any window width and shape, ultrawide included, and the web, tablet and phone builds (AD-17, AD-19) will want layouts of their own. A layout tied to one aspect ratio, or to breakpoints scattered through screens, would have to be rewritten for each.

_Decision._ Two independent inputs choose the layout, and screens know neither.

1. _Form-factor profile and input style come from the host._ `HostInfo` carries `formFactor` (`desktop`, `web`, `tablet`, `phone`) and `input` (`pointer` fine or coarse, `hover` yes or no) next to the platform (AD-19). They are read once at mount and never guessed from the window width. A browser host reads the `pointer` and `hover` media queries in its adapter; the renderer never does.
2. _The width class is computed in one place._ `compact`, `medium`, `regular`, `wide`, `ultrawide`, with their thresholds in one table (`layout/width-class.ts`; in CSS pixels: 0, 600, 900, 1600, 2560). Regular starts at the minimum window width, so the narrower classes appear only when the area is smaller than a window or zoomed. `LayoutProvider` measures the width of its own root element (not `window.innerWidth`, so a split view or an embedding behaves like a window) and keeps only the class in state.
3. _A layout is a registry lookup._ `(profile, width class)` gives a `LayoutDefinition`: the navigation form (`leftPane` or `drawer`), what the top bar shows and what moves to an overflow menu, and the content column rules (maximum width, padding step). Each profile lists only the classes it needs. The lookup takes the class itself, then the nearest narrower class the profile defines, then the profile's default, then the same for desktop; a profile with no entry uses desktop. The nearest-narrower step refines the first agreed rule (class, profile default, desktop), which sent ultrawide to the regular layout, narrower than wide.
4. _Input style is not a width matter._ Touch target size (`TARGET_SIZE_PX`: 32 for a pointer, 44 for touch) and whether controls may rely on hover come from `interactionFor(input)`, so a desktop window dragged narrow keeps pointer targets and a tablet at desktop width keeps touch targets. The registry never carries them.
5. _Screens describe content, shells arrange it._ Only `renderer/src/ui/fluent/` shells and page layouts decide positions and widths. Two checks enforce it: a dependency-cruiser rule keeps `screens/` from importing the layout modules or the layout hook, and a source check fails a screen that contains a media query, `matchMedia`, a width read, a resize observer, `formFactor`, a class name or an inline style.
6. _Placement._ The profile, width-class, registry and resolver logic is pure and unit tested in `renderer/src/layout/`, and imports no React, Fluent or DOM (checked). The React glue is `app/layout-context.tsx`. The Fluent shell (`app-shell.tsx`, one component whose navigation form follows the layout, so the page keeps its place in the tree and its state, such as an open dialog, survives a resize across a threshold), the content region and the compact top bar stay under `ui/fluent/` (AD-15). There is one bundle; code-splitting per profile is a later option, because a profile is a registry entry.

_Desktop layouts now._ Compact and medium: a drawer opened from a top bar button (it closes after a page is chosen, on Escape and on the backdrop, and returns focus to the button), the menu entries and commands in an overflow menu, the month picker on its own row, full-width content. Regular: the left pane, the full top bar, a 1240 px column. Wide and ultrawide: the same with a 1440 px column. Tablet and phone have no entries yet and use the desktop layouts; adding one is a registry entry plus its shell variants.

_Alternatives rejected._ Detecting the profile from the window width fails for a phone in landscape or a desktop window made narrow. Breakpoints inside screens spread layout across every page. CSS media queries alone cannot change the navigation form or the top bar's content.

_Consequences._ At ultrawide widths the column stays centred with empty space beside it; using the width (a details panel beside a table, say) is for screens that have such content. The input style is fixed at mount; a host whose input can change at run time needs a change subscription, added with the first such host. A hover-free rule exists in `interactionFor` but no control uses it yet. The integration matrix covers every profile at every width class, with device emulation for tablet and phone, and must get a table per profile once a profile has its own entries.
