# Kickoff prompt: Avalonia slice

Paste everything below the line into a new session on this repository.

---

You are building the Avalonia (C#) half of a throwaway stack-selection spike for Folio, a local-first desktop budget app. A second, separate session builds the same slice in Electron with TypeScript. The two results are compared against fixed gates, so honest measurement matters more than a polished app.

Start here:

1. `git fetch origin` then `git checkout spike/slice-avalonia`. Work only on that branch. Never push to `main`, to `spike/stack-selection-base` or to `spike/slice-electron`, and never open a pull request.
2. Read `SLICE-SPEC.md` in full, then `README.md` and `RESULTS-TEMPLATE.md`. They define what to build, the gates, what to measure and the working rules. Follow them exactly. Do not use subagents.
3. Read the product context from `main` with `git show origin/main:<path>`: `knowledge/product/month-end-review-design.md`, `knowledge/product/month-end-review-shell.md`, `knowledge/architecture/02_constraints.md`, `knowledge/architecture/11_risks.md`, and look at `design/Month-End_Financial_Review-v1.html` as the visual reference.

Stack specifics:

- Pins to start from (copy what you need from `main`, for example `global.json` and the package versions in `Directory.Packages.props`): .NET 10, Avalonia 12.1.5 (Avalonia, Desktop, Skia, Headless), FluentAvaloniaUI 3.1.0, Avalonia.Controls.DataGrid 12.1.2 (deprecated upstream, bug fixes only). The real project enforces strict analyzers and warnings as errors; for this throwaway you may relax them to move faster, but note that in the effort log.
- Put code under `avalonia/`. Use the free pieces only: no paid Avalonia components or tools (Charts, TreeDataGrid, Dev Tools). Charts may be custom-drawn or a free MIT library; record which and the effort it took.
- Known risks to test, not assume: DataGrid memory growth on large mixed-text grids (Avalonia.Controls.DataGrid issue 228), no UI-automation support for DataGrid rows and cells (issue 267), and FluentAvalonia ContentDialog not taking keyboard focus on Windows and Linux (FluentAvalonia issue 766). Report what you actually observe. If the DataGrid fails G2, try the least invasive free alternative you can find and record it as a finding.
- For G3, the project's planned design is a small loopback-only automation server inside the app: bound to 127.0.0.1, a random per-session token written with the port to a user-only discovery file, requests rejected without the token, a `Host` check and no `Origin` header allowed. It is described in AD-16 in `knowledge/architecture/09_architecture_decisions.md` on `main`. Build a minimal version (status, navigate, state as JSON, screenshot) plus a tiny CLI or test client, and drive it from CI under Xvfb on Linux and directly on Windows. Also try Avalonia's headless mode, but real-window runs are the G3 evidence.
- For G1, run the app with no network route on Linux (for example in a network namespace with only loopback) and also capture traffic during a five-minute idle, and record the result.

Finish by copying `RESULTS-TEMPLATE.md` to `RESULTS.md`, filling it in honestly, committing everything and pushing your branch. If you cannot pass a gate, say so and why, and stop rather than bending the measurement. When you are blocked or done, summarize where things stand.
