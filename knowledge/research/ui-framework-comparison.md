# Research brief: UI framework options for Folio

- _Date:_ 2026-11-11
- _Requested by:_ Jeremy, while planning the regression suite
- _Status:_ Research behind the stack decision. Jeremy chose Electron with TypeScript on 2026-11-12 (AD-17); this brief records the options considered and the evidence, and is kept as history. Sections 1 to 8 predate the spike measurements and the decision.
- _Question:_ Is Avalonia the right platform for Folio? How does it compare with other cross-platform C# frameworks and with non-C# options, judged on what the PRD and the HTML prototype need and not on the current stack?

Evidence labels: _vendor claim_ means a framework's own documentation says so and I found no independent test. _Single source_ means one secondary blog or article. _UNVERIFIED_ means needs checking before anyone relies on it. All searches ran on 2026-11-11 and several results were third-party mirrors or undated, so versions and dates in them are leads, not facts. Nothing here was built or run.

---

## 1. Summary

- _Avalonia is still a defensible choice._ Its framework is MIT. What went paid is tooling and some components (Dev Tools, Charts, TreeDataGrid and similar), as the Folio risk register already records (R8, R9). The Community tier is free for individuals, but its legal schedule gives no right to ship Accelerate components. The decisions in the Folio constraints (no paid Avalonia products) already contain that.
- _The problems you have run into are mostly the ecosystem around Avalonia, not Avalonia itself._ The deprecated DataGrid with no UI-automation for rows and cells (R4, R7), the one-maintainer FluentAvalonia (R1, R2) and no free charts (AD-13) are all UI-library gaps. A framework change only helps if the new one fills them.
- _Accessibility is mixed everywhere._ Avalonia 12's docs claim full support on Windows, macOS and Linux (vendor claim). Uno has Windows and macOS only, Linux planned. Compose Desktop has none on Linux. Flutter's desktop status is unclear from what I found. A web view (Electron) gets the browser's accessibility tree on every OS.
- _The strongest non-C# alternative is a web UI in a desktop shell._ Folio is tables, forms, dialogs and charts. That is the web's strongest ground, and its testing tools are the most mature. The cost is that the domain code, now C#, would need either a bridge or a rewrite.
- _No option is clearly better on every point._ Switching buys different problems. I would not leave Avalonia on the strength of this research alone. The rest of this brief says what would change that.

---

## 2. What Folio actually needs (from the PRD and prototype)

| Need                                                                | Source               | Why it matters for the choice                                                                      |
| ------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------- |
| Windows, macOS and Linux desktop                                    | PRD constraints      | Rules out anything without a real Linux story                                                      |
| Document-style app: open, autosave, backups, atomic writes          | H1.6 to H1.11        | Local file access and a reliable runtime; no server                                                |
| Data-heavy tables: transactions, accounts, import preview, balances | Prototype screens    | A fast, sortable, selectable table (the prototype uses 10k-row scale in the spike plan)           |
| Charts: donuts, bars, net worth history, click through to data      | A1.6, A1.16, A1.17   | A charting library or custom drawing                                                               |
| Forms, tabs, dialogs, banners, nav pane, light and dark themes      | Prototype, H1.4, H1.9 | A mature control set; the prototype is Fluent-styled                                               |
| Native macOS menu, Cmd shortcuts, hamburger menu elsewhere          | H1.14 to H1.16       | Native menu support on macOS                                                                       |
| Drag and drop CSV, file dialogs                                     | I1.1                 | Basic OS integration                                                                               |
| Privacy: no network by default, no telemetry, no phone-home        | H1.12                | No licence check or analytics in the shipped app                                                   |
| Driveable by agents and tests (CLI, screenshots)                    | H1.17, AD-16         | A framework whose UI can be inspected and automated reliably in CI                                 |
| Free for a hobby project                                            | Jeremy               | Open licence for what ships and what builds it                                                     |
| Money rules, locked months, undo, rules engine                      | AD-3 to AD-9         | UI-independent. The language of the Core matters more than the UI toolkit (see section 5)          |

---

## 3. Options compared

| Option                                  | Language                  | Rendering                                   | Linux | Licence for our use                                          | Accessibility (desktop)                                                                    | Automated UI testing                                                                                | Fit for Folio                                                                                             |
| --------------------------------------- | ------------------------- | ------------------------------------------- | ----- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Avalonia 12 (current)                   | C#, XAML                  | Own (Skia)                                  | Yes   | Framework MIT; Dev Tools, Charts, TreeDataGrid paid          | UIA on Windows, NSAccessibility on macOS, AT-SPI2 on Linux, all "full" (vendor claim)      | Headless tests, our AD-16 CLI; OS-level drivers hampered by missing grid automation (#267)         | Good control set; gaps in grid, charts and Fluent library; already invested                               |
| Uno Platform                            | C#, WinUI XAML            | Own (Skia) on desktop                       | Yes   | Framework Apache 2.0; Studio tooling has a free Community tier | Windows (Narrator) and macOS (VoiceOver) since 6.6; Linux planned                          | Not researched in depth                                                                             | Closest like-for-like swap; weaker Linux accessibility; WinUI controls and a real DataGrid worth checking |
| .NET MAUI                               | C#, XAML                  | Native controls                             | No    | MIT                                                          | Native on Windows and macOS                                                                | Not researched                                                                                      | Rules itself out: Microsoft plans no Linux desktop. Avalonia's own MAUI backend is a preview, with adoption concerns (single source) |
| Electron                                | JS or TS, HTML, CSS       | Bundled Chromium                            | Yes   | MIT                                                          | Chromium's accessibility tree on every OS                                                  | Playwright is officially supported and drives the real window                                       | Best libraries for tables and charts; heaviest runtime (tens to hundreds of MB, single-source figures) |
| Tauri 2                                 | Rust backend, web UI      | OS web view (WebKitGTK on Linux)            | Yes   | MIT or Apache 2.0                                            | Depends on the web view; no official guidance found for WebKitGTK                          | WebDriver on Windows and Linux only, not macOS; Playwright does not drive it on macOS or Linux     | Small and private; Linux rendering quirks (blank window, GPU issues) and uneven testing                    |
| Flutter desktop                         | Dart                      | Own (Impeller or Skia)                      | Yes   | BSD                                                          | Windows documented (UIA); macOS and Linux unclear from my sources                          | Not researched                                                                                      | Production-viable per several 2026 articles; desktop plugin gaps and new language                         |
| Compose Multiplatform Desktop           | Kotlin                    | Own (Skia)                                  | Yes   | Apache 2.0                                                   | Full on macOS, Windows via Java Access Bridge, none on Linux (official table)              | Not researched                                                                                      | Maturing; no Linux accessibility, so not better than Avalonia on that axis                                |
| Qt 6 (QML, or PySide6 for Python)       | C++, QML, or Python       | Own                                         | Yes   | LGPL v3 or commercial; some modules GPL only                 | Not researched                                                                             | Not researched                                                                                      | Mature and capable; licensing needs care; not .NET                                                         |
| Slint                                   | Rust, C++, JS, Python     | Own                                         | Yes   | Royalty-free licence requires showing Slint attribution; GPL-3 option | "Basic infrastructure" only                                                                | Not researched                                                                                      | Small widget set; desktop readiness still described as in progress; too young for a data-heavy app        |

---

## 4. Findings on the concerns you raised

### 4.1 "Some of their stuff going paid"

- Avalonia's own pages say the framework stays MIT and what is licensed is tooling and advanced components. There is a free Community tier for individuals, a 30-day trial, and Pro, Plus and Enterprise above it.
- The Community tier's schedule says it is developer tools only and gives no right to embed or ship Accelerate UI components. That matches why the project already excludes paid components.
- I could not find prices, and several legal schedules show inconsistent effective dates (one lists 1970, others show late 2026). Check [avaloniaui.net](https://avaloniaui.net) directly before relying on anything.
- Verdict: a real cost of the ecosystem (free dev tools, charts, grids), not a licence problem for the framework or for what Folio ships. The existing constraint already protects against it.

### 4.2 Accessibility reading

- Avalonia: the docs claim automation peers on every control and full support on all three platforms, with a new AT-SPI2 backend in Avalonia 12 (vendor claim). I found no independent testing or known-issues list. Folio's own risk R7 stands: DataGrid rows and cells are not reachable (#267), and that is a DataGrid gap, not a framework-wide one.
- Uno: screen readers work on Windows and macOS from 6.6; Linux is planned.
- Compose: no Linux accessibility in the official table.
- Flutter: Windows is documented; the rest I could not confirm.
- Electron and Tauri: accessibility comes from the browser engine. Chromium (Electron) gives the same tree on every OS. Tauri uses the OS web view, so quality varies, and I found no official guidance for Linux.
- Verdict: for a household app the accessibility bar is probably "keyboard works, nothing reads wrong" rather than formal conformance. The web is the strongest option here, and Avalonia is not obviously worse than the other native-drawn toolkits.

### 4.3 Testing the UI

- The web route has the best testing story by far. Electron supports Playwright officially and drives the real window.
- Tauri is weaker: Playwright does not work with the OS web view on macOS and Linux, and WebDriver support covers Windows and Linux only.
- For the native-drawn frameworks, the common path is in-process headless tests plus a private automation channel, which is what AD-16 plans. That makes Avalonia's testing story roughly equal to the others, not worse.

---

## 5. The Core question

Section 1 of the PRD and AD-1 to AD-12 put almost all the difficulty in the domain: locked months, classification, undo by month-tagged change sets, rules, import pipelines. That code is UI-free C# in `Folio.Core` with unit and property tests. The UI framework decision should not drag it along unless there is a strong reason.

| Direction                                                         | What happens to `Folio.Core`                                                                            | Cost                                                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Stay in .NET (Avalonia, Uno)                                      | Unchanged                                                                                               | Low. Work is on the UI side only                                                              |
| Web UI with a .NET backend process (Electron or a local web host) | Unchanged, but the UI talks to it over a local channel; AD-16's loopback server could become the main API | Medium. A new UI project and a bridge; loopback token and `Host` checks become core security |
| Rust, Kotlin, Dart or Python end to end                           | Rewritten                                                                                               | High. The architecture decisions would need redoing, and the risk of changing money rules   |

Correction (2026-11-11): I first called the third direction a clear no on cost. That overstated it. The repo holds about 686 lines of C# in 7 files, mostly scaffold, and `Folio.Core` is an empty assembly marker. The architecture decisions are mostly language-neutral; what would be redone is their C#-specific parts (money and date types, CommunityToolkit.Mvvm, the analyzers and the `csharp_base` standards). A TypeScript stack is a serious option, covered in section 9.

---

## 6. What would justify leaving Avalonia

Leave only if one of these shows up in the stack spike:

1. The DataGrid memory growth (#228) or the missing grid automation (#267) cannot be worked around, and there is no free replacement grid.
2. FluentAvalonia becomes unmaintained and the wrapper isolation (AD-15) proves too costly to carry.
3. You want first-class screen-reader support on Linux and find the Avalonia 12 backend not good enough in practice.
4. Writing and maintaining custom charts (AD-13) proves heavier than expected, and a web UI's chart libraries would remove it.

Until then, the isolation already in AD-13 and AD-15 is the hedge: charts sit behind view-models, FluentAvalonia types sit behind wrappers, and the Core knows nothing about either.

---

## 7. Gaps in this research

- Uno's DataGrid, charting and automated-testing story, and Qt's accessibility and testing, were not researched.
- Flutter's macOS and Linux accessibility, and its desktop testing, were not confirmed.
- No benchmark, prototype or build was run. Everything above comes from documentation, vendor pages and secondary articles.
- I did not look for charting or grid libraries per framework beyond what is already in AD-13 and R4. For a web UI that would be the largest advantage and should be checked next.
- Prices for Avalonia's paid tiers are unknown.

## 8. Open questions for Jeremy

1. Is the main motivation cost, accessibility, long-term maintainability, or wanting to learn something new? The answer changes which options deserve a spike.
2. Is a heavier runtime (Electron) acceptable if it removes the grid, chart and testing gaps?
3. Would you rather stay in .NET and keep `Folio.Core` as is, or is a rewrite of the Core acceptable if the language is more interesting to you?
4. Should a small throwaway prototype (the Transactions grid with a chart in two candidate stacks) be added to the stack spike as a comparison, like the planned TableView comparison?

---

## 9. Follow-up research: TypeScript desktop options (2026-11-11)

Requested after the brief above: the shortlist is Avalonia versus a TypeScript stack, probably Electron. Desktop is the focus; web is wanted later; mobile is optional. A research agent read primary sources (Electron, Tauri, Deno and Playwright docs and source via raw GitHub; package metadata from npm). It captured no live network traffic, so every phone-home conclusion comes from reading source and docs.

### 9.1 Does Electron phone home?

Verified in Electron's source (`shell/browser/browser_process_impl.cc` and related files): stock Electron has no Chromium component updater, no Safe Browsing, no variations seed fetch, no network-time service and no GCM. Its metrics consent is hard-coded false. The crash reporter does nothing until JavaScript calls `crashReporter.start()`. The auto-updater does nothing until the app sets a feed URL. Geolocation needs an API key the app must supply.

Two environmental leaks remain:
- _Spellcheck dictionaries._ Downloaded from a Google CDN by default (documented). No typed text is sent. Fix: set a dictionary URL or disable spellcheck.
- _System proxy auto-detect (WPAD)._ Plausible on Windows when the OS has automatic detection on. Whether Electron's default path issues the request was not verified. Fix: `--no-proxy-server`.

Minimal hardening set (the agent's synthesis from source, not an official checklist): never start the crash reporter; no auto-updater, and make update checks a user action; `no-proxy-server`; a deny-all request filter and permission handler; serve the UI from a custom protocol with a strict CSP; set or disable spellcheck; no `GOOGLE_API_KEY`; block navigation and external opens; set production fuses (with a possible need for a separate E2E build, see 9.4).

Verdict: an Electron app can credibly meet "nothing leaves the computer unless opted in", if the app enforces it three ways: configuration, request blocking, and a CI network-capture test. Recommended capture test: a Linux job in a no-route network namespace plus `strace` on connects, a second run through a capturing proxy and `tcpdump` over a five-minute idle window, and an in-app Playwright request assertion. Rerun it on every Electron bump. The Windows and macOS capture tooling on hosted runners is unverified.

Tauri: core has no telemetry, and the updater plugin acts only when called, with mandatory signatures. The exposure is the OS web view. On Windows, WebView2 has Microsoft diagnostic data and updates itself outside the app's control (secondary source, page unreadable); wry already disables SmartScreen. macOS and Linux web view network behavior was not verified.

### 9.2 Tauri versus Avalonia on cross-platform weakness

Tauri's real weakness is the three web engines (WebView2, WKWebView, WebKitGTK) that the app does not pin. That affects pixel regression, mixed-script text rendering and table performance, and the runner image or OS can change the baseline without any dependency changing. Avalonia draws everything itself and renders the same on each OS. Electron pins Chromium in `package.json`, so it matches Avalonia on consistency.

Tauri testing is better than first reported:
- WebdriverIO's `@wdio/tauri-service` works on Windows, Linux and macOS through an embedded WebDriver server (verified in Tauri's current docs).
- `tauri-driver` covers Windows and Linux.
- Stock Playwright cannot drive Tauri on macOS or Linux. The community `tauri-playwright` plugin bridges the gap but is under a year old.
- Both options are young, and Tauri still needs Rust commands for file locking and atomic writes.

### 9.3 Other TypeScript desktop options

| Option                  | Status (read 2026-11-11)                                                         | Notes                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Electron                | v45.3.0 on Chromium 156, released 2026-11-10; MIT                                | Full Node `fs`, Chromium accessibility tree on all OSes, Playwright support (experimental per secondary sources) |
| Tauri 2                 | 2.12.5; 3.0 alpha in progress; MIT or Apache 2.0                                 | Smallest footprint (hello-world figures only); Rust for native work                                   |
| Electrobun              | v2.0.6; MIT; README signals one primary maintainer                               | Bun main process; no Playwright integration found                                                     |
| Neutralino              | Active; MIT; solo maintainer                                                     | Small; no Playwright integration found                                                                |
| NW.js                   | 0.119.2; MIT                                                                     | Chromium-sized; Selenium path unverified                                                              |
| Wails v3                | GA 2026-10-26; MIT                                                               | Go backend, not TypeScript domain code                                                                |
| Deno desktop            | Shipped in Deno 2.9; experimental per secondary sources                          | Updater polls a configured URL; default setting not verified                                          |
| React Native Windows/macOS | Microsoft-backed                                                              | No Linux target found; not HTML, so none of the web grid and chart libraries                         |
| Capacitor with Electron | Community plugin last released 2023                                              | Stale; use Electron directly                                                                         |
| Browser-only PWA        | Platform feature                                                                 | See 9.5                                                                                              |

### 9.4 Risks and unknowns

Electron plus TypeScript:
1. Footprint (roughly 85 to 100+ MB installers, from hello-world blog figures) and Chromium security updates every one to two weeks. Mitigation: the no-network capture on every bump.
2. Hardening drift if a later change re-enables a crash reporter, updater or permission default.
3. Playwright's Electron support is experimental, and a fuse-hardened build may reject test attach. A separate E2E build would mean the tested binary is not the shipped one. Not confirmed; Playwright's Electron docs were unreadable in the sandbox.
4. Screenshot baselines are per OS (Playwright names them per browser and platform), so three baseline sets are needed, and mixed-script fonts differ per OS.
5. A Node-enabled main process plus a preload bridge is a security surface. Treat imported CSVs as untrusted.

Tauri plus TypeScript:
1. Unpinned web view versions (section 9.2).
2. Windows WebView2 diagnostic data and runtime updates are outside the app's control.
3. E2E tooling is under a year old.
4. Two languages, with locking and atomic writes in Rust that agents must write and review.
5. Unknown: how well WKWebView and WebKitGTK expose their accessibility trees to automation.

### 9.5 Web and mobile reach

A TypeScript domain package and UI could be shared with a web build from any of these. The web version would lose:
- The File System Access API, which is Chromium-only, with no Firefox or Safari support and no sign of that changing.
- A user-visible file that autosaves in place; OPFS is a private store, so the fallback is open by upload and save by download.
- Native menus, OS file locks and atomic rename.
- Storage that the browser cannot evict.

The recommended shape is a platform-neutral core with a `FileStore` interface (open, save, lock, back up) and desktop and web implementations. Mobile would be Capacitor or Tauri mobile (stability unverified) around the same UI.

### 9.6 UI libraries (npm metadata, read 2026-11-11)

All free and updated in 2026: Fluent UI React v9 (9.75.2, MIT), TanStack Table with TanStack Virtual (MIT), AG Grid Community (36.3.0, MIT; some features Enterprise-only, not fully checked), ECharts (6.1.0, Apache 2.0), Recharts, visx, D3, Chart.js, fast-check (4.10.2) and fflate or zip.js for the file format. Fluent v9's `DataGrid` README does not mention virtualization, so test it with 10,000 rows or pair a virtualizer. A broader survey of design systems is in 9.7.

### 9.7 Design systems beyond Fluent (secondary sources)

Most-used React options: shadcn/ui (copy-in, fastest growing; upstream fixes do not arrive automatically), MUI (usage leader; MUI X data grid features such as multi-sort, column pinning and row grouping need paid tiers), Ant Design (usual pick for dashboards; free Table, Form and Tree), Mantine (fast rising; no grid equivalent to MUI X), and unstyled primitives (Radix, now slowed; Base UI as active successor; React Aria as the most accessibility-rigorous). Company systems IBM Carbon, Atlassian, Polaris and Primer are free; no source compared them on dense tables. Rankings come from SEO blogs and no source tested table accessibility. A claim that shadcn/ui made Base UI its default in July 2026 is single-source and should be checked against its changelog.

### 9.8 Not verified

Live network traffic from any shipped app; Electron's WPAD behavior and renderer crash upload path; WebView2's privacy page; Playwright's Electron docs and fuse requirements; measured size and memory for a real data-heavy app on any option; AG Grid Community feature boundaries; whether Tauri's WebKit views expose a usable accessibility tree.

---

## Sources

- Avalonia licensing and Community edition: https://docs.avaloniaui.net/accelerate/community , https://avaloniaui.net/blog/building-a-sustainable-future-for-avalonia , https://avaloniaui.net/legal/10A
- Avalonia accessibility: https://docs.avaloniaui.net/docs/app-development/accessibility , https://avaloniaui.net/blog/avalonia-12
- MAUI on Linux: https://www.theregister.com/2025/11/13/dotnet_maui_linux_avalonia/ , https://avaloniaui.net/blog/net-maui-is-coming-to-linux-and-the-browser-powered-by-avalonia
- Uno: https://platform.uno/pricing , https://platform.uno/docs/articles/features/accessibility/index.html , https://infoq.com/news/2026/08/uno-platform-6-6
- Tauri testing and Linux graphics: https://v2.tauri.app/develop/tests/webdriver/ , https://v2.tauri.app/develop/debug/linux-graphics/
- Electron and Tauri comparison: https://www.pkgpulse.com/guides/electron-vs-tauri-2026 , https://betterstack.com/community/guides/scaling-nodejs/tauri-vs-electron-vs-deno-vs-electrobun/
- Flutter: https://docs.flutter.dev/ui/accessibility/assistive-technologies
- Compose Multiplatform: https://kotlinlang.org/docs/multiplatform/compose-desktop-accessibility.html
- Qt licensing: https://doc.qt.io/qt-6/licensing.html
- Slint licence: https://open.windriver.com/info/uni-license-list/licenses/slint-royalty-free-1.0.html , https://www.slint.dev/blog/making-slint-desktop-ready
- Folio: [01_introduction_and_goals.md](../architecture/01_introduction_and_goals.md), [02_constraints.md](../architecture/02_constraints.md), [09_architecture_decisions.md](../architecture/09_architecture_decisions.md), [11_risks.md](../architecture/11_risks.md), [month-end-review.md](../product/month-end-review.md), [month-end-review-design.md](../product/month-end-review-design.md)
