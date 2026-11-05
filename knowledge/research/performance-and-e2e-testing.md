# Research brief: performance, stress and end-to-end testing for Folio

- _Date:_ 2026-11-05
- _Requested by:_ Jeremy, during the test-definition discussion on the scaffold PR
- _Status:_ Exploration only. There is no architecture decision, plan or implementation, and nothing here is approved. It records what we would want and the options, so the separate initiative starts from a shared picture.
- _Question:_ For Folio, what should performance, stress and end-to-end (E2E) testing cover? What tools and setups could do it? Where and how often should each run? How does each relate to the unit, integration and architecture tests that already exist?

Evidence labels: _verified_ means checked in a repository or package during this session. _Background_ means common practice I know of but did not re-check this session. _UNVERIFIED_ means it needs confirming before anyone relies on it. Several primary sources (martinfowler.com, learn.microsoft.com, xunit.net, the Google Testing blog, avaloniaui.net) were blocked in this session.

---

## 1. Summary

1. _Keep this separate from the regular test setup._ Performance and stress results depend on the machine and are noisy, and E2E runs are slow and can fail for reasons unrelated to the change being tested. Large .NET projects keep them out of the pull-request test loop: benchmarks live in their own projects, and expensive tests are tagged or run on a schedule (verified for Avalonia, Npgsql and Polly layouts; dotnet/runtime's `[OuterLoop]` trait verified in source).
2. _Four activities with different tools:_
   - micro-benchmarks of hot code paths
   - scenario timings and memory budgets for whole operations (open, save, import, close a month)
   - stress and soak testing, including random operation sequences that check invariants
   - E2E scenarios through the running app
3. _One shared prerequisite: a deterministic synthetic household generator._ Seeded, realistic data (accounts, provider CSVs, rules, splits, closed months) feeds benchmarks, budgets, stress runs and E2E alike. It is the first thing worth building when the initiative starts.
4. _For E2E, Folio's own automation server and CLI (AD-16) is the natural main driver._ It is fast, deterministic, the same on all three platforms, and works headless. A few real-window smoke tests through operating-system UI automation (Appium or FlaUI) would add coverage of actual input, focus and dialogs. That matters because of the known FluentAvalonia dialog-focus bug (#766). (Inference)
5. _The highest-value stress test protects the product's main promise._ Random sequences of import, edit, rule change, undo, close and reopen, with a check after every step that locked months never change (A1.14). It can run in-process against the command layer with no UI. (Inference)

---

## 2. What is already settled

- Performance and E2E stress testing are a separate initiative, not further kinds of the unit/integration/architecture setup. Whether they use that setup at all is part of this investigation (AD-14).
- AD-1 sets a goal: a file-size and open-time budget with a warning threshold and a failure threshold, measured against a heavy synthetic household. How and where it is measured is left to this initiative.
- AD-16 defines a loopback automation server, a `folio` CLI and a headless mode. A throwaway probe on 2026-11-05 showed headless Avalonia 12.1.5 serving state, navigation and screenshots over `HttpListener` (verified in this session).
- The stack spike plan already includes a 10,000-row DataGrid stress check and the first version of the automation server. Both are inputs here, not substitutes.

---

## 3. What we would want to cover

### 3.1 Performance (speed and memory of known operations)

| Area                      | Why it matters for Folio                                                                      | Candidate measures                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Open and save             | AD-1 keeps everything in memory and rewrites the whole file on every save, including autosave | Open time, save time and file size against history length (1, 5, 10 years); peak memory while saving |
| Classification and totals | Every edit reclassifies lines; open months are recalculated live (AD-3)                       | Time to reclassify a month or a year; time to recompute report totals after one edit                 |
| Rules engine              | Rule-impact previews run over all open-month transactions (C1.8, C1.9, AD-9)                  | Preview time for 2,000 rules against 30,000 lines                                                    |
| Import                    | The preview is a dry run of the real import (AD-8)                                            | Preview time for a large CSV (5,000+ rows), including duplicate and transfer matching                |
| Undo and redo             | Change sets are replayed (AD-5)                                                               | Time to undo a whole large import or rule change                                                     |
| Reporting                 | Averages over 3, 6 or 12 locked months, plus drill-downs                                      | Time to build each report view for a 10-year file                                                    |
| UI responsiveness         | The DataGrid is deprecated and has a reported memory issue on Avalonia 12 (#228)              | Startup time, page navigation, scroll and sort at 10k to 30k rows, memory after scrolling            |
| Allocations               | More stable than timings across machines, so usable as a gate                                 | Allocated bytes per open, save, import or reclassify                                                 |
| Leaks                     | Long sessions, and opening and closing files and pages                                        | Objects still alive after closing a file or page and forcing garbage collection                      |

### 3.2 Stress and soak

- _Random operation sequences with invariant checks_ (model-based or property-based). Generate random sequences of commands and check invariants after each step:

  - locked-month totals never change
  - transaction lines always sum to their transaction
  - undo followed by redo returns the same state
  - save then load gives an equal model

  This tests the system's central promise directly.

- _Long sessions:_ hours of mixed operations in one session, watching memory, handle counts and the size of the undo history.
- _Hostile input:_ very large CSVs, malformed rows, odd encodings and delimiters, extreme amounts. This overlaps with unit tests of the import stages, but at volume.
- _File robustness:_ simulated crashes mid-save, a file changed by another computer, a full disk. These check the guarantees of atomic save, backups and on-disk change detection (AD-12).

### 3.3 End-to-end scenarios

- _The monthly flow:_ new file → add accounts → import → categorize → review → close → reopen with a reason → close again. Check that totals, history and later-month re-confirmation flags (M1.11) are right.
- _File lifecycle:_ autosave timing, Save/Discard on close, crash recovery from a backup, the corrupt-file error offering a backup (H1.11).
- _Cross-platform smoke on real windows:_ keyboard focus in dialogs, the macOS native menu (H1.16), theme switching, drag-and-drop import.
- _Visual regression:_ screenshots of key pages in light and dark themes, compared against approved images.

---

## 4. Options and tools

### 4.1 Micro-benchmarks

- _BenchmarkDotNet_ is the de facto standard: warm-up, statistics, and a memory diagnoser for allocations (background). Large projects keep benchmarks in their own console project. Avalonia, Npgsql and Polly each have a separate benchmarks project (verified from repository layouts).
- Large-scale setups add dedicated infrastructure: dotnet/runtime runs microbenchmarks from a separate `dotnet/performance` repository on lab hardware and tracks regressions over time, and ASP.NET Core uses the Crank load tool on dedicated machines (background, _UNVERIFIED_ in detail).

### 4.2 Scenario timings and budgets

- A small harness that generates a synthetic household, then times open, save, import and other operations in-process, or through the CLI against a running app.
- Collecting detailed data when a budget fails: `dotnet-counters` and `dotnet-trace` (EventPipe) give CPU, GC and allocation detail (background).
- _Gating:_ allocation counts and file sizes are stable enough to fail a build on. Timings on shared CI runners are noisy, so the usual choices are:

  - generous thresholds that catch only large regressions
  - running the base branch and the PR head back to back in the same job and comparing
  - a dedicated self-hosted runner

  (Background)

- _Regression tracking over time:_ GitHub Action-based benchmark trackers that store results and comment on changes exist (_UNVERIFIED_: tool names and current state).

### 4.3 Leak detection

- The simplest approach: hold a weak reference to a page or view-model, close it, force garbage collection, and assert that it has been collected.
- Avalonia keeps a dedicated `LeakTests` project (verified from repository layout). Its exact technique, possibly JetBrains dotMemory Unit, is _UNVERIFIED_.

### 4.4 Stress through random command sequences

- _FsCheck_ or _CsCheck_ can generate command sequences and shrink a failing sequence to the smallest one that still fails (background).
- This runs in-process against Core, needs no UI, and fits naturally after the command layer and lock guard exist.

### 4.5 E2E drivers

| Option                                                        | How it drives the app                                                       | Strengths                                                                                             | Weaknesses                                                                                                         |
| ------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Folio automation server and CLI (AD-16)                       | Same commands, queries and view-model actions as the UI, over loopback HTTP | Fast, deterministic, identical on all three platforms, works headless in CI, agents can use it        | Skips real mouse and keyboard input, focus and layout                                                              |
| Appium (WinAppDriver or newer Windows drivers; Mac2 on macOS) | Operating-system UI automation (accessibility tree)                         | Real input and rendering; Avalonia is reported to use it for its own integration tests (_UNVERIFIED_) | Slow and fragile; needs a real desktop session; the DataGrid lacks UI-automation support for rows and cells (#267) |
| FlaUI                                                         | Windows UI Automation from .NET                                             | Mature on Windows, plain C#                                                                           | Windows only                                                                                                       |
| Avalonia headless (`Avalonia.Headless`)                       | In-process, simulated input                                                 | Already used by integration tests; screenshots possible                                               | Not a separate process, so it is not truly end to end                                                              |

A likely mix: most scenarios through the CLI (headless in CI), and a small real-window smoke suite per OS through Appium or FlaUI, run nightly or before releases. (Inference)

### 4.6 Visual regression

- _Verify.Avalonia_ snapshots headless renders and compares them against approved images. Its compatibility with Avalonia 12 is _UNVERIFIED_; its last release reportedly predates Avalonia 12.
- Headless screenshots need Skia rendering rather than headless drawing, and fonts and anti-aliasing differ by OS, so approved images are usually kept per platform. (Background)

---

## 5. Where and how often each would run

| Cadence                      | Candidates                                                                                                                                      |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Every PR                     | Only cheap, stable gates: file-size and allocation budgets with generous margins; a handful of headless CLI E2E smoke scenarios, if fast enough |
| Nightly or on main           | Full benchmark suite with tracked results; full headless E2E suite on Windows, macOS and Linux; leak tests; short stress and fuzz runs          |
| Before releases or on demand | Real-window smoke suite per OS; long soak runs; visual regression review                                                                        |

---

## 6. How this relates to the existing test setup

- Benchmarks are console apps, not test projects, so they would sit outside `tests/`, for example in `perf/` or `benchmarks/`.
- E2E and stress suites could be xUnit projects, but should stay out of `Folio.slnx`'s default test run. The current `TestLayoutTests` only allows `tests/Unit`, `tests/Integration` and `tests/Architecture`, so new suites either live outside `tests/` or the layout rule gains new kinds. That is a decision for the initiative.
- Tagging, left open in AD-14, could mark "slow" tests if some stress checks end up inside the regular projects.

---

## 7. Prerequisites and dependencies

1. _Synthetic household generator._ Seeded and deterministic, with realistic accounts, provider-specific CSVs, rules, splits, transfers and closed months. Shared by every activity above.
2. _Command layer, lock guard and change sets_ (AD-4, AD-5). Needed for random-sequence stress testing.
3. _Automation server and CLI_ (AD-16, spike milestone 5). Needed for E2E.
4. _The `.folio` file format_ (AD-2). Needed for open, save and size budgets.
5. _Stable CSV fixtures per provider_ (RBC, TD, Tangerine, EQ Bank, Questrade, CTFS). Needed for import benchmarks and E2E.

---

## 8. Open questions for Jeremy

1. Should any performance check gate pull requests (for example size and allocation budgets), or should all of it run nightly?
2. Is a self-hosted runner (one stable machine) acceptable for timing benchmarks, or should we rely only on relative comparisons on GitHub-hosted runners?
3. How much real-window E2E do we want: none, a small smoke suite per OS, or broad coverage? Real-window E2E is where most maintenance cost goes.
4. Should random-sequence stress testing count as part of this initiative, or as an extension of unit tests? It runs in-process and checks a product rule, but it is slow when run long.
5. Visual regression: is it worth keeping approved images per platform, or are screenshots for human review enough?

---

## 9. Suggested follow-up research (not a plan)

- Confirm how Avalonia runs its own Appium-based integration and leak tests, and whether Appium drivers work with Avalonia 12 apps on Windows and macOS.
- Check Verify.Avalonia's Avalonia 12 support, or alternatives.
- Survey GitHub Actions benchmark-tracking options and how noisy GitHub-hosted runners are.
- Compare FsCheck and CsCheck for state-machine testing of the command layer.

---

## Sources

- Repository layouts inspected in this session (verified): AvaloniaUI/Avalonia (`tests/`, including benchmarks and leak tests, and `nukebuild/Build.cs`), npgsql/npgsql (`test/`), App-vNext/Polly (`test/`)
- dotnet/runtime `[OuterLoop]` attribute (verified in source): https://source.dot.net/Microsoft.DotNet.XUnitExtensions/src/Microsoft.DotNet.XUnitExtensions.Shared/Attributes/OuterLoopAttribute.cs.html
- Google test sizes (secondary summaries; the original was blocked): https://documentdrivendx.github.io/helix/research/google-test-sizes/ , https://testing.googleblog.com/2010/12/test-sizes.html
- Microsoft unit-testing best practices (blocked; read through search excerpts): https://learn.microsoft.com/dotnet/core/testing/unit-testing-best-practices
- Avalonia testing docs and Verify.Avalonia: https://docs.avaloniaui.net/docs/testing/ , https://github.com/VerifyTests/Verify.Avalonia
- DataGrid UI-automation issue #267 and memory issue #228: https://github.com/AvaloniaUI/Avalonia.Controls.DataGrid/issues
- FluentAvalonia dialog focus issue #766: https://github.com/amwx/FluentAvalonia/issues/766
- Folio architecture decisions AD-1, AD-2, AD-3, AD-4, AD-5, AD-8, AD-9, AD-12, AD-14, AD-16: [09_architecture_decisions.md](../architecture/09_architecture_decisions.md)
- Folio stack spike plan, milestones 3 and 5: [stack-spike.md](../../plans/stack-spike.md)
