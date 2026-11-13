# Research brief: performance, stress and end-to-end testing for Folio

- _Date:_ 2026-11-05, revised 2026-11-12 for the Electron stack
- _Requested by:_ Jeremy, during the test-definition discussion on the scaffold PR
- _Status:_ Exploration only. There is no plan or implementation for the performance and stress work, and nothing here is approved. The end-to-end driver is decided (AD-16). The brief records what we would want and the options, so the separate initiative starts from a shared picture.
- _Question:_ For Folio, what should performance, stress and end-to-end (E2E) testing cover? What tools and setups could do it? Where and how often should each run? How does each relate to the unit, integration, architecture and E2E tests defined in AD-14?

Evidence labels: _measured_ means a spike session ran it on GitHub-hosted runners (Windows, macOS and Linux, no GPU). _Background_ means common practice I know of but did not re-check this session. _UNVERIFIED_ means it needs confirming before anyone relies on it.

---

## 1. Summary

1. _Keep performance and stress work separate from the regular test loop._ Results depend on the machine and are noisy, and E2E runs are slow and can fail for reasons unrelated to the change being tested. Expensive tests run on a schedule or on demand, not on every pull request.
2. _Four activities with different tools:_
   - micro-benchmarks of hot code paths in the core
   - scenario timings and memory budgets for whole operations (open, save, import, close a month)
   - stress and soak testing, including random operation sequences that check invariants
   - E2E scenarios through the running app
3. _One shared prerequisite: a deterministic synthetic household generator._ Seeded, realistic data (accounts, provider CSVs, rules, splits, closed months) feeds benchmarks, budgets, stress runs and E2E alike. The selection spike already has a stack-neutral seeded generator for transactions (10,000 mixed-script rows); it is the starting point.
4. _For E2E, the AD-16 layers are the driver._ Plain Node tests run the core with no window for domain scenarios, and Playwright drives the packaged app through a debugging pipe for UI scenarios. A real window matters for focus and dialogs. The spike measured dialog focus, Tab order and per-OS screenshot stability on Windows and macOS runners.
5. _The highest-value stress test protects the product's main promise._ Random sequences of import, edit, rule change, undo, close and reopen, with a check after every step that locked months never change (A1.14). It runs in-process against the command layer with no UI, using fast-check. (Inference)

---

## 2. What is already settled

- Performance and stress testing are a separate initiative, not further kinds of the four-kind test setup. Whether they use that setup at all is part of this investigation (AD-14).
- AD-1 sets a goal: a file-size and open-time budget with a warning threshold and a failure threshold, measured against a heavy synthetic household. How and where it is measured is left to this initiative.
- AD-16 defines the E2E driver: core tests in plain Node, Playwright through a debugging pipe against the release binary, and per-OS screenshots and a network capture.
- The selection spike measured a 10,000-row virtualized grid on all three OSes. Worst scroll frame was 16 to 17 ms and the slowest sort about 31 ms on Linux and Windows; memory after scrolling was about 161 MB (Windows, private working set) and 206 MB (macOS, footprint), and 441 MB (Linux, proportional). All numbers came from CI runners without a GPU. These are inputs here, not budgets.

---

## 3. What we would want to cover

### 3.1 Performance (speed and memory of known operations)

| Area                      | Why it matters for Folio                                                                      | Candidate measures                                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Open and save             | AD-1 keeps everything in memory and rewrites the whole file on every save, including autosave | Open time, save time and file size against history length (1, 5, 10 years); peak memory while saving            |
| Classification and totals | Every edit reclassifies lines; open months are recalculated live (AD-3)                       | Time to reclassify a month or a year; time to recompute report totals after one edit                            |
| Rules engine              | Rule-impact previews run over all open-month transactions (C1.8, C1.9, AD-9)                  | Preview time for 2,000 rules against 30,000 lines, including the linear-time regex engine                       |
| Import                    | The preview is a dry run of the real import (AD-8)                                            | Preview time for a large CSV (5,000+ rows), including duplicate and transfer matching                           |
| Undo and redo             | Change sets are replayed (AD-5)                                                               | Time to undo a whole large import or rule change                                                                |
| Reporting                 | Averages over 3, 6 or 12 locked months, plus drill-downs                                      | Time to build each report view for a 10-year file                                                               |
| UI responsiveness         | Large virtualized tables and charts in a Chromium renderer                                    | Startup time, page navigation, scroll and sort at 10k to 30k rows, memory after scrolling                       |
| Allocations               | More stable than timings across machines, so usable as a gate                                 | Heap growth per open, save, import or reclassify                                                                |
| Leaks                     | Long sessions, and opening and closing files and pages                                        | Memory after a soak of repeated scrolls, sorts and file opens; objects still alive after closing a file or page |

### 3.2 Stress and soak

- _Random operation sequences with invariant checks_ (model-based or property-based). Generate random sequences of commands and check invariants after each step:

  - locked-month totals never change
  - transaction lines always sum to their transaction
  - undo followed by redo returns the same state
  - save then load gives an equal model

  This tests the system's central promise directly.

- _Long sessions:_ hours of mixed operations in one session, watching memory, process counts and the size of the undo history. The spike's soak (20 more full scrolls with a sort and a filter change between each) showed no growth beyond noise; a longer soak was not run.
- _Hostile input:_ very large CSVs, malformed rows, odd encodings and delimiters, extreme amounts. This overlaps with unit tests of the import stages, but at volume.
- _File robustness:_ simulated crashes mid-save, a file changed by another computer, a full disk. These check the guarantees of atomic save, backups and on-disk change detection (AD-12).

### 3.3 End-to-end scenarios

- _The monthly flow:_ new file → add accounts → import → categorize → review → close → reopen with a reason → close again. Check that totals, history and later-month re-confirmation flags (M1.11) are right.
- _File lifecycle:_ autosave timing, Save/Discard on close, crash recovery from a backup, the corrupt-file error offering a backup (H1.11).
- _Real-window smoke on Windows and macOS:_ keyboard focus in dialogs, the macOS native menu (H1.16), theme switching, drag-and-drop import.
- _Visual regression:_ screenshots of key pages in light and dark themes, compared against approved images kept per operating system.

---

## 4. Options and tools

### 4.1 Micro-benchmarks

- _tinybench_ or Vitest's benchmark mode for hot paths in the core, run in Node (background). Keep benchmark files out of the unit test run.
- Node's `--cpu-prof` and `--heap-prof` give CPU and allocation detail when a budget fails (background).

### 4.2 Scenario timings and budgets

- A small harness that generates a synthetic household, then times open, save, import and other operations in-process through core tests in plain Node, or against the packaged app through Playwright.
- _Memory in the app:_ measure every process of the app, not only the main one. The selection spike found that the number a tool reports for the app's own process can be wrong by a factor of four to twenty when the page runs in separate processes, and defined one metric per OS: proportional memory (PSS) on Linux, private working set on Windows, and physical footprint on macOS. Its scripts are the starting point (measured).
- _Gating:_ heap growth and file sizes are stable enough to fail a build on. Timings on shared CI runners are noisy, so the usual choices are:

  - generous thresholds that catch only large regressions
  - running the base branch and the PR head back to back in the same job and comparing
  - a dedicated self-hosted runner

  (Background)

- _Regression tracking over time:_ GitHub Action-based benchmark trackers that store results and comment on changes exist (_UNVERIFIED_: tool names and current state).

### 4.3 Leak detection

- The simplest approach for the core: hold a `WeakRef` to an object, drop it, force garbage collection (Node's `--expose-gc`), and assert it was collected.
- For the renderer, repeat scrolls, sorts and page changes under Playwright and read memory through the app's metrics before and after.

### 4.4 Stress through random command sequences

- _fast-check_ generates command sequences and shrinks a failing sequence to the smallest one that still fails (background).
- This runs in-process against the core, needs no UI, and fits naturally after the command layer and lock guard exist.

### 4.5 E2E drivers

| Option                                                 | How it drives the app                                                            | Strengths                                                                                                                      | Weaknesses                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Core tests in plain Node (AD-16, layer 1)              | Runs the real core on files in a Node process                                    | Fast, deterministic, no display, the same on every OS, agents can use it                                                       | Skips the UI entirely                                                                                               |
| Playwright through the debugging pipe (AD-16, layer 2) | Attaches to the exact release binary; locates controls by role, name and test ID | Real window, real DOM, structured state through a test hook, screenshots, traces; measured passing on Windows, macOS and Linux | Debugging switches are guarded and fuse settings matter; synthetic key events do not move focus the way a user does |
| OS-level UI automation (FlaUI, Appium)                 | Reads the operating-system accessibility tree                                    | Real input and rendering                                                                                                       | Slow and fragile; needs a real desktop session; not needed while Playwright covers the DOM                          |

A likely mix, already adopted by AD-16: most scenarios through core tests in plain Node, UI scenarios through Playwright on Windows and macOS runners, and a nightly or pre-release pass of the full suite. (Inference)

### 4.6 Visual regression

- Playwright's screenshot comparison keeps baselines per browser and platform, because fonts and anti-aliasing differ by OS. Keep one baseline set per OS, generated on the matching runner. In the spike, two consecutive runs on identical code matched within 0.1% of pixels on every OS (measured).
- Baselines change when Electron's Chromium changes, which is why updates run behind the suite (AD-18).

---

## 5. Where and how often each would run

| Cadence                      | Candidates                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Every PR                     | Only cheap, stable gates: file-size and heap-growth budgets with generous margins; a handful of core scenario tests; a short Playwright smoke if fast enough |
| Nightly or on main           | The full Playwright suite on Windows and macOS; the full benchmark suite with tracked results; leak tests; short stress and fuzz runs; the network capture   |
| Before releases or on demand | Long soak runs; visual regression review; real-hardware checks (a GPU, the macOS display, low-end machines)                                                  |

---

## 6. How this relates to the existing test setup

- Benchmarks are scripts, not tests, so they sit outside `tests/`, for example in `perf/`.
- E2E suites are Playwright projects under `tests/e2e/` (AD-14). They stay out of the default unit and integration run.
- Tagging, left open in AD-14, could mark "slow" tests if some stress checks end up inside the regular projects.

---

## 7. Prerequisites and dependencies

1. _Synthetic household generator._ Seeded and deterministic, with realistic accounts, provider-specific CSVs, rules, splits, transfers and closed months. Shared by every activity above. A stack-neutral transaction generator exists from the selection spike.
2. _Command layer, lock guard and change sets_ (AD-4, AD-5). Needed for random-sequence stress testing.
3. _The Playwright harness_ (AD-16). Needed for E2E.
4. _The `.folio` file format_ (AD-2). Needed for open, save and size budgets.
5. _Stable CSV fixtures per provider_ (RBC, TD, Tangerine, EQ Bank, Questrade, CTFS). Needed for import benchmarks and E2E.

---

## 8. Open questions for Jeremy

1. Should any performance check gate pull requests (for example size and heap-growth budgets), or should all of it run nightly?
2. Is a self-hosted runner (one stable machine) acceptable for timing benchmarks, or should we rely only on relative comparisons on GitHub-hosted runners?
3. How much real-window E2E do we want beyond the smoke suite? It is where most maintenance cost goes.
4. Should random-sequence stress testing count as part of this initiative, or as an extension of unit tests? It runs in-process and checks a product rule, but it is slow when run long.
5. Visual regression: is it worth keeping approved images per platform, or are screenshots for human review enough?

---

_Sources._

- Folio architecture decisions AD-1, AD-2, AD-3, AD-4, AD-5, AD-8, AD-9, AD-12, AD-14, AD-16, AD-18: [09_architecture_decisions.md](../architecture/09_architecture_decisions.md)
- The stack-selection results (kept on the `spike/slice-*` branches as read-only reference) and the comparison brief: [stack-decision-comparison.md](stack-decision-comparison.md)
- Playwright snapshot documentation (baselines per platform): https://playwright.dev/docs/test-snapshots
- fast-check: https://github.com/dubzzz/fast-check
