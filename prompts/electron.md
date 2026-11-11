# Kickoff prompt: Electron with TypeScript slice

Paste everything below the line into a new session on this repository.

---

You are building the Electron with TypeScript half of a throwaway stack-selection spike for Folio, a local-first desktop budget app. A second, separate session builds the same slice in Avalonia (C#). The two results are compared against fixed gates, so honest measurement matters more than a polished app.

Start here:

1. `git fetch origin` then `git checkout spike/slice-electron`. Work only on that branch. Never push to `main`, to `spike/stack-selection-base` or to `spike/slice-avalonia`, and never open a pull request.
2. Read `SLICE-SPEC.md` in full, then `README.md` and `RESULTS-TEMPLATE.md`. They define what to build, the gates, what to measure and the working rules. Follow them exactly. Do not use subagents.
3. Read the product context from `main` with `git show origin/main:<path>`: `knowledge/product/month-end-review-design.md`, `knowledge/product/month-end-review-shell.md`, and look at `design/Month-End_Financial_Review-v1.html` as the visual reference (it is already web code, so reuse its structure and values where that helps). Also read the research brief on the planning branch: `git show origin/claude/relaxed-volta-biy41e:knowledge/research/ui-framework-comparison.md`, especially section 9 (privacy hardening for Electron and the testing options).

Stack specifics:

- Put code under `electron/`. Use current stable Electron, TypeScript in strict mode, and a Vite-based React setup. Design system: Fluent UI React v9 (`@fluentui/react-components`). For the grid and charts choose free (MIT or equivalent) libraries; the brief names candidates (TanStack Table with TanStack Virtual, AG Grid Community, ECharts, Recharts, visx). Record what you chose, why and what you had to build yourself. Note any feature you needed that the free tier lacks.
- Privacy (G1) is the headline risk. Apply the hardening set from the brief: never call `crashReporter.start()`, no auto-updater and no update check, `app.commandLine.appendSwitch('no-proxy-server')` before ready, a deny-all `webRequest` filter and permission handler, serve the UI from a custom protocol (not `file://`) with a strict Content-Security-Policy, spellcheck disabled or its dictionary URL set, no `GOOGLE_API_KEY`, navigation and new-window blocking, and production fuses. Then verify it empirically: run the app with no network route on Linux (for example a network namespace with only loopback) and capture traffic during a five-minute idle plus use of every page. Report exactly what you see, including anything surprising. Do not assume the brief is right.
- For G3, use Playwright's Electron support (`_electron.launch`) to start the real window, navigate, read page state as structured data and take screenshots. On Linux run under Xvfb. Decide and record how structured page state is exposed (for example a small test-only state API behind the preload bridge). Test with the fuse-hardened build; if hardening blocks Playwright from attaching, record that and what you had to change, because it decides whether the tested binary is the shipped one. Also check that Windows runs in CI.
- For G2, test with all 10,000 rows, mixed-script text, sorting each column, and scrolling the whole grid twice. Measure memory of the whole app (all processes), not just the renderer.
- Keep file access and everything the renderer can reach minimal: contextIsolation on, nodeIntegration off, a small validated preload bridge.

Finish by copying `RESULTS-TEMPLATE.md` to `RESULTS.md`, filling it in honestly, committing everything and pushing your branch. If you cannot pass a gate, say so and why, and stop rather than bending the measurement. When you are blocked or done, summarize where things stand.
