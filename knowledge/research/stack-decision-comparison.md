# Stack decision: Avalonia (C#) versus Electron (TypeScript)

- _Date:_ 2026-11-12
- _Requested by:_ Jeremy, after the selection slices and follow-ups
- _Status:_ Recommendation for Jeremy's decision. Nothing here is approved, and no architecture decision, plan or constraint has been changed.
- _Sources:_ the measured results on the spike branches (`spike/slice-avalonia`, `spike/slice-electron`, `spike/slice-tauri`) and the research briefs ([framework brief](ui-framework-comparison.md), the Teams-for-Linux and Tauri research summarized in section 9 of that brief and below).

Evidence labels: _measured_ means a spike session ran it on GitHub-hosted runners and the CI run was green (I checked the run conclusions, not the artifacts). _Agent-read_ means a research agent reported it from a primary source and I did not re-open it. _Inferred_ is my judgement. Everything measured was on runners with no GPU, a software renderer and, on macOS, a small VM display, so absolute numbers on real machines will differ.

---

## 1. What you asked for

1. Desktop first. Web very much wanted (a read-only version is enough to start). Mobile later, not mandatory.
2. Memory matters but is not decisive.
3. C# is nice to have, but you are willing to learn.
4. Non-UI interactive testing so agents can do end-to-end testing. AD-16 (a loopback automation server) is one way, not the only way.
5. From earlier: free and open source only; privacy is a hard requirement; accessibility matters at first mostly so UI test tooling can drive the app; long-term supportability matters.

## 2. Short answer

**Recommend Electron with TypeScript.** My earlier lean was Avalonia, because Avalonia passed every pre-agreed gate and Electron failed the memory gate by a small margin. That ranking followed the gates as written. Your priorities then added web (very wanted), mobile (later) and willingness to learn a new language. Those change the weighing, because they decide whether Folio ends up with one codebase or two, and whether the table is accessible in a browser. Avalonia is the better desktop-only application. Electron is the better foundation for a product that will also be a web app.

What you accept by choosing Electron: roughly twice Avalonia's memory on Windows and Linux, a package about 2 to 3 times larger, a standing privacy-hardening discipline, and a faster dependency update treadmill. All are manageable and each has a mitigation below.

## 3. Evidence at a glance

Measured numbers, same scenario and same per-OS metric. Avalonia is the stock DataGrid; Electron is the slice with the Chromium sandbox on. "P2/P3" means after the first and second full scroll of 10,000 rows.

| Measure | Avalonia | Electron |
| ------- | -------- | -------- |
| Memory, Linux, proportional (P2 / P3) | 224 / 224 MB (P5 257) | 441 / 429 MB |
| Memory, Windows, private working set | 87 MB | 161 MB |
| Memory, macOS, footprint | 177 MB | 206 / 200 MB |
| Package size | Linux zip 47 MB, self-contained folder 107 MB (Windows 210 MB); no installer built | `.deb` 101 MB, AppImage 126 MB, NSIS 121 MB |
| Worst scroll frame (Linux / Windows) | 46 / 76 ms | 17 / 16 ms |
| Slowest sort to a rendered frame | 54 to 82 ms | about 31 ms |
| Cold start to usable window (Linux / Windows / macOS) | 0.9 / 2.3 / 1.1 s | 0.5 / 0.7 / 1.2 s |
| Gates G1 to G6 as written | all pass (G1 captured on Linux; Windows and macOS lower confidence) | G2 fails on Linux proportional memory by 41 MB; others pass |
| Real window drivable in CI on all three OSes | yes (one caveat: real key events on macOS untested) | yes, exact release binary through a debugging pipe |
| Build time | 19 to 31 s | Vite 1.4 s, packaging about 3 s |

All of these were measured. Caveats: each number is a handful of CI runs, Electron's macOS frame times were never recorded, and Avalonia's first-pass frames on macOS (stock DataGrid) reached 152 ms once, which exceeds the 100 ms rule as written.

## 4. Criterion by criterion

### 4.1 Web, then mobile (your highest new priority)

- **Electron/TypeScript.** The renderer is plain web code. A read-only web build needs only a file input and a zip reader (no server, no File System Access API, works in every browser, and keeps the privacy promise by parsing the file locally). The Tauri slice showed the same renderer ran in three OS web views with 12 lines of change out of 873, which is evidence that the UI is shell-independent. Real DOM means the browser's own accessibility and ordinary Playwright tests apply to the web build (inferred, consistent with the Electron slice's tree dumps). Mobile later would wrap the same UI (Capacitor 8.6.0 exists on npm, agent-read; Tauri mobile exists, stability unverified). The hard part of mobile is not the UI but the file model (a `.folio` file in a synced folder). That problem exists in every option.
- **Avalonia.** `Avalonia.Browser` 12.1.0 runs the app as WebAssembly and draws on a canvas. Accessibility is rated "partial" by Avalonia itself (it mirrors the control tree into ARIA), the canvas is opaque to assistive technology, one community report says a screen reader did not work on a demo, and the download is large (about 25 MB without ahead-of-time compilation, about 50 MB with it, from a single secondary source). File access is sandboxed, with the File System Access API where the browser has it. The shared accessibility gaps we found (no grid or table provider interfaces; DataGrid peers lacking selection) sit above the platform bridges and are very likely to carry over (inferred). Mobile: Avalonia targets iOS and Android, which I did not evaluate.
- **Verdict: Electron, clearly.** The risk with Avalonia is not that the web build is impossible but that an accessible, lightweight web version would in practice be a second UI, which is the two-codebase outcome you said you want to avoid.

### 4.2 Memory and footprint

- Avalonia is lighter: about half on Windows and Linux, and 15% lighter on macOS, with a smaller package. That is a real advantage on low-end machines and for many instances.
- Electron's cost is mostly the framework, not the app: an empty Electron page measured about 266 MB proportional memory on Linux, so roughly two thirds of the app's footprint is Chromium. No lever tested brought the peak reliably under 400 MB without turning off GPU rasterization.
- The Tauri slice tested the "use the OS web view" escape from this and it did not help: on Windows the saving was about 6% (private working set) and total working set was higher; on macOS it was about 2.5 to 3 times higher; on Linux 25 to 30% higher with default graphics. Only installer size dropped dramatically.
- Weighing: you said memory is important but not decisive. For a once-a-month household app on a modern machine, 160 to 440 MB is unlikely to matter. It is a cost, not a blocker. If the app were run all day on small machines I would weigh it more.

### 4.3 Non-UI interactive testing and agent drivability

All three stacks passed G3: the real window can be started, asked for structured state, navigated, screenshotted and closed, in CI on Linux, Windows and macOS. The difference is in what else you get.

- **Layer 1, the core without a window.** Folio's hard logic is the domain core. If it is written in TypeScript it runs unchanged in Node (a command-line tool for agents and scripts), in the browser (the web build), and inside Electron. If it is C# it runs in a console host. Both support the same style of agent-driven, window-free testing (import a CSV, query totals, close a month, assert). TypeScript additionally lets the same core code run in the web build and any mobile wrapper.
- **Layer 2, the UI through its accessibility tree.** Electron/Playwright locates controls by role and name in the DOM and can drive the exact release binary through Chromium's debugging pipe (measured, with a guard that refuses debugging unless an environment variable is set). Avalonia has no Playwright equivalent: its UI tests use headless mode, the in-process automation server, or OS-level accessibility drivers, whose reach is limited by the platform-bridge gaps (4.5). Both stacks needed OS-level key injection or a real-key mode for Tab behaviour in some tests.
- **Layer 3, real-window smoke per OS with pixel baselines and a network capture.** Both did it. Electron's Chromium is pinned, so baselines move only when you bump it.
- **AD-16.** The Avalonia slice implemented it in about 150 lines. It is a good idea but it is a security surface (a network listener in the release binary with its own enabling ceremony). With Electron it is largely unnecessary: the test-only state hook plus Playwright through the debugging pipe, plus a Node command-line tool for the core, cover the same ground without a listener in the shipped app. I would keep the idea (a stable, documented, scriptable control surface) but implement it as the layers above, and add a guarded loopback server later only if agents need to inspect release builds remotely.
- **Verdict:** both can be tested well. Electron has the larger ecosystem and a more natural fit for agents (DOM, ARIA snapshot, screenshot).

### 4.4 Privacy

- **Avalonia.** No embedded web engine. Captures on Linux and Windows showed no non-loopback activity from the app, and macOS sampling agreed (moderate confidence). Two things to handle: the `Avalonia.BuildServices` package sends build-time usage data (a record GUID, machine GUID, hashed project and device identifiers, OS, Avalonia version) unless opted out, and the opt-out is ignored if the Accelerate Community or Trial tools are signed in. It can be removed with `ExcludeAssets="all"` or an overriding target (measured to stop it). The shipped app is unaffected.
- **Electron.** A stock Electron app has no component updater, Safe Browsing, variations seed or metrics upload (agent-read from source). The follow-up capture found one real default leak: Chromium's spellcheck dictionary request to Google's CDN, which my research brief's hardening set did not prevent. It was fixed in the slice by setting an empty spellcheck language list. Chromium also does an IPv6 reachability `connect()` before every host resolution, which cannot be switched off, and is absent only while the app makes no requests. Linux capture was clean after the fix. **Windows and macOS Electron captures are weak or absent** (macOS lsof only; Windows not attempted), so the privacy claim for Electron on Windows is unproven.
- **Verdict:** Avalonia is simpler to keep private. Electron can meet the requirement, but only with a CI network-capture job that runs on every Electron update and a person who reads its output. The Teams for Linux project, a mature Electron wrapper, documents "no telemetry" but says nothing about these default behaviours, which supports treating such claims as unverified until captured (agent-read).

### 4.5 Accessibility, for testing now and users later

- **For testing tools (your stated first goal)**, both are adequate. Rows can be found and read, and selection state can be exposed on both. Avalonia needs work: its default Linux build hid all page content from the accessibility tree because of FluentAvalonia's navigation view (a ~30-line workaround exists), the stock DataGrid exposes no real selected state, and AutomationIds were not set (a convention to adopt).
- **For screen-reader users later**, Electron is ahead in what the platform tree reports (Windows reports the full 10,001-row grid with selection; Linux and macOS report rendered rows only). Avalonia cannot report counts, positions or cell coordinates from application code on any OS, because its Windows, Linux and macOS bridges lack the table concepts (measured, with source references from the spike). Closing that is estimated at 3 to 6 weeks of work in a forked Avalonia (inferred). Both stacks' real screen-reader runs (NVDA) were crude: Electron's moved cell by cell and announced no "selected"; Avalonia's DataGrid candidates were silent and only a custom ListBox table read rows well.
- **Verdict:** equal for testing now; Electron better for users later and for the web build.

### 4.6 Long-term support

**Avalonia**
- The framework is MIT and backed by a company (AvaloniaUI OÜ). Its monetization is in tooling and components (Dev Tools, Charts, TreeDataGrid), which you already exclude by constraint. Pricing and terms are in flux (legal schedules showed inconsistent dates), and the free Community tier gives no right to ship Accelerate components.
- The UI-library layer is thin. The DataGrid is deprecated and bug-fix only (163 open issues, "no new features", 7 committers in 12 months). FluentAvalonia has one dominant maintainer (159 of 193 commits in 12 months, 11 committers), a last commit about 11 weeks old at the check, and no announced support for Avalonia 12.2, which you have pinned below. The community DataGrid fork ProDataGrid is reported (agent, unverified) to be 98.9% one author. Charts are custom.
- Avalonia major versions bring breaking changes (12 removed the free diagnostics tool). The pinned-version dance (Avalonia, FluentAvalonia and the DataGrid must agree) is a real recurring task.
- The 41 of 74 DataGrid source files with Microsoft Ms-PL headers mean a third-party notices file is needed even for the stock package.
- Net: the core is healthy, the ecosystem around it is fragile. You would own a growing share of UI infrastructure over time.

**Electron**
- Electron is an OpenJS Foundation project: 1,757 commits by 142 authors in 12 months (agent-read). Fluent UI React is Microsoft-maintained (908 commits, 65 authors). ECharts is an Apache project (23 authors; one release in six months, the slowest). TanStack Virtual is founder-led (one dominant author, sponsor funded): the closest to a single-maintainer dependency, and also swappable.
- The cost is the treadmill. Electron ships a new major roughly every two months, tracking Chromium, and Chromium security fixes are your job once you bundle it. The Teams for Linux project made 32 Electron version bumps in about a year and went from Electron 39 to 44 between January and October 2026 (agent-read). Plan for monthly updates. The regression-suite plan (Dependabot grouping, Playwright, per-OS screenshots, the network-capture job) exists for exactly this.
- It has real Linux maintenance costs, from the Teams for Linux history (agent-read): the Chromium sandbox failing on Ubuntu 24.04 unless the `.deb` ships an AppArmor profile (electron-builder's default install script does this), AppImage silently losing the sandbox, Wayland and X11 regressions across Electron majors, and NVIDIA crashes fixed only in specific patch releases. I measured the sandbox and AppImage findings myself in the follow-up; the rest come from that project's issue history.
- The web-stack skills and libraries (React, TypeScript, Playwright) are the largest talent and AI-training base in this space (inferred), and the UI libraries are replaceable. That is the strongest long-term-support argument: the part that is most likely to be abandoned (a particular component library) can be swapped without touching the domain.
- **Net:** a heavier, faster-moving runtime with a deeper and more replaceable ecosystem.

### 4.7 Language and the domain core

The hard part of Folio is the domain: locked months, undo by month-tagged change sets, the rules engine, the import pipeline. The architecture keeps it UI-free.

- **TypeScript core.** Runs everywhere (Node, browser, Electron, mobile wrappers), which is what makes web and mobile cheap. Money as integer cents is safe (a safe integer holds about 90 trillion dollars). fast-check is the property-testing library for the locked-month invariants. Weaknesses: no native decimal and weaker compile-time guarantees than C#, so use branded types and schema validation at the file boundary (for example zod) and keep strict mode on. File I/O (atomic write, lock file) lives behind a `FileStore` interface with Node and browser implementations.
- **C# core.** Stronger types and a familiar language for you. It runs in a console host and, with effort, as WebAssembly in a browser, but then the web UI would be a different codebase or Avalonia's canvas.
- **Your willingness to learn tilts this.** TypeScript is close to C# syntactically, so the learning curve is mainly the React and tooling ecosystem and the loss of some type guarantees.

### 4.8 Security surface

- **Electron:** a renderer that handles personal financial files, plus a main-process and preload bridge, needs context isolation, the sandbox, a validated preload API, a strict content-security policy and fuses on. The slice applied all of these. Teams for Linux, which had to turn sandbox and context isolation off to scrape Teams' page, has had two published advisories as a result; a finance renderer has no such need and should keep them on (agent-read).
- **Avalonia:** no embedded browser, so a smaller surface, no sandbox concept. Any malware running as the same user can read the `.folio` file either way.

### 4.9 Effort so far, and switching cost

- Avalonia's slice took about 30 minutes in the first round and 1 correction-free session; Electron's about 1.3 hours. These are not like for like (Electron did far more privacy hardening work), so I would not weigh them.
- Switching cost later: a decision for Avalonia that later needs a first-class web app means a second UI and probably a rewritten core; a decision for Electron that later wants a smaller shell can move to Tauri (12 lines of renderer change in the slice, plus Rust for file safety) or keep Electron. A decision for Electron is the cheaper one to reverse.

## 5. Options compared in one table

| Criterion | Avalonia | Electron + TypeScript | Leader |
| --------- | -------- | --------------------- | ------ |
| Desktop footprint (memory, size) | about half the memory on Windows and Linux, smaller package | heavier, mostly the framework | Avalonia |
| Desktop smoothness | frame spikes in some runs, 54 to 82 ms sorts | 17 ms frames, 31 ms sorts | Electron |
| Web (read-only first) | canvas, partial accessibility, large download | same renderer, real DOM | Electron, clearly |
| Mobile later | iOS and Android targets exist, not evaluated | wrapper around the same UI, not evaluated | Electron (inferred) |
| Window-free agent testing | yes, via a console host | yes, via Node | tie |
| UI testing by agents | headless, automation server, weaker OS drivers | Playwright on the real binary | Electron |
| Privacy by default | simpler, one build-time item | needs hardening plus continuous capture | Avalonia |
| Accessibility for testing now | adequate with a workaround | adequate | tie |
| Accessibility for users later | cannot reach table semantics in app code | closer, real DOM on web | Electron |
| Ecosystem depth and replaceability | thin, single-maintainer pieces | deep, swappable | Electron |
| Runtime maintenance burden | pinned stack dance, breaking majors | monthly Chromium updates | roughly even, different kinds |
| Linux packaging | straightforward | AppArmor, sandbox, Wayland, NVIDIA work | Avalonia |
| Language fit for you | C# | TypeScript (learning) | Avalonia, mildly |
| Cost to reverse | high | lower | Electron |

## 6. Recommendation

**Choose Electron with TypeScript**, and treat it as a deliberate exception to gate G2 (Linux proportional memory 441 MB against a 400 MB limit that was a proposal, not a requirement). The deciding factors are the web goal, the replaceable ecosystem and the testing fit. The memory difference is real and I would not hide it.

Make the choice safer with these conditions, which also become the first Phase 2 work:

1. **Platform-neutral core.** Write the domain in pure TypeScript with no Node or Electron imports, plus a `HostApi` and a `FileStore` interface (open, save, lock, back up, menu and drop events) with Electron, browser and mock implementations. This gives the read-only web build, fast tests, and a cheap exit to another shell.
2. **Privacy as a CI gate, not a document.** Keep the hardening set (no crash reporter, no updater, no-proxy flag, deny-all request filter, empty spellcheck languages, custom protocol with strict CSP, fuses) and run the network-capture job on every Electron bump. Add the Windows and macOS captures that are missing, using the Tauri slice's Windows sampler as the starting point.
3. **Linux packaging.** Ship the `.deb` first (electron-builder's default install script installs the AppArmor profile), run an Ubuntu 24.04 job that installs it and launches without `--no-sandbox`, treat the AppImage as secondary because it silently loses the sandbox, and test X11 and Wayland.
4. **Test stack.** Three layers: the core as a Node command-line tool for window-free agent testing; Playwright against the real window through the debugging pipe with a guard; and per-OS screenshot baselines with the capture job. AD-16 becomes "a documented, scriptable control surface" implemented by those layers, with a guarded loopback server only if release-build inspection is needed later.
5. **Update discipline.** Budget monthly Electron updates behind the regression suite, pin Electron exactly, and re-test the GPU and display-server paths on each major.
6. **Defer table accessibility depth.** Real screen-reader polish is a later initiative; for now give rows names and selection state and add stable test IDs.
7. **Reconsider the design system.** The slice used Fluent UI React v9 (Microsoft-maintained, 65 authors) to match the prototype. That is a safe choice; changing it is cheap because it is a renderer decision.

**What would change my recommendation to Avalonia:** the web build is deferred indefinitely or becomes a different, much smaller product; footprint turns out to matter (low-end hardware, many instances); you decide you want C# for the long term more than a shared web and mobile codebase; or the privacy-hardening burden proves too high to maintain. If you choose Avalonia, carry these conditions: exclude the build-telemetry package, add a third-party notices file, adopt AutomationIds, track the FluentAvalonia and DataGrid maintainer risk, and treat the web version as a separate, later effort whose accessibility may need a second UI.

## 7. What is not known

- Real GPUs, Wayland and low-end hardware (every number is from CI runners without a GPU).
- Electron's network behaviour on Windows and macOS, and Avalonia's on macOS (moderate to low confidence).
- Avalonia's and Capacitor's mobile stories; Avalonia on Wayland.
- A longer soak than 20 scrolls, signed installers, and updates (deliberately absent).
- Several maintenance facts are agent-reported and were not re-verified (ProDataGrid's author share, Avalonia's upstream accessibility issues, Electron's contributor counts).
- How the Chromium network behaviours change with future Electron majors. This is why the CI capture job is a condition.
