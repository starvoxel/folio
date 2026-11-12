# Follow-up prompt: Electron with TypeScript slice

Paste everything below the line into the existing Electron session (resume it) or a new session on this repository.

---

Your Electron slice and `RESULTS.md` were reviewed against the Avalonia slice. The review found gaps that could change the stack decision. This follow-up closes them. It is measurement and investigation, not new features. The same rules as before apply: stay on your own branch, never push elsewhere or open a pull request, no subagents, report honestly, and do not tune anything to improve a number.

Start here:

1. `git fetch origin && git checkout spike/slice-electron`.
2. Copy the follow-up files into your branch: `git checkout origin/spike/stack-selection-base -- FOLLOWUP-SPEC.md FOLLOWUP-RESULTS-TEMPLATE.md tools/measure-memory.py`, and commit them.
3. Read `FOLLOWUP-SPEC.md` in full. Do items F1 (memory, same method), F2 (macOS) and F3 (platform accessibility tree) as written there, then the Electron-specific items below. Write everything to `FOLLOWUP-RESULTS.md` (from `FOLLOWUP-RESULTS-TEMPLATE.md`), and keep `EFFORT-LOG.md` going. Do not edit the verdicts already in `RESULTS.md`; use a Corrections section if something was wrong.

Electron-specific items:

- **E1. The non-loopback `connect()`.** Your capture found a UDP `connect()` to `2001:4860:4860::8888` port 443 and you believe it is Chromium's IPv6 reachability probe. Confirm or refute it from Chromium's source (find the code, link it, and say which version you read). Then find out whether it can be avoided: try relevant switches and feature flags, DNS and host-resolver settings, and an environment with IPv6 disabled, and report what each does to the capture. Say plainly whether a result with no `connect()` to any non-loopback address is achievable. Re-run the capture on the release binary, not only the test binary.
- **E2. Chromium sandbox on Linux.** CI runs with `--no-sandbox`. For a finance app that is a security cost. On `ubuntu-24.04` (and on the sandbox here if it differs), find out why the sandbox does not start (setuid `chrome-sandbox` helper, unprivileged user namespaces, AppArmor restrictions), what a real distribution package (AppImage, deb) would need so the sandbox works for an ordinary user, and test the packaged app running with the sandbox on. Report the result and the cost.
- **E3. Close the tested-binary gap.** The inspect-arguments fuse stops Playwright from attaching, so you test a copy that differs by one fuse. Try to run the G3 scenario against the exact release binary instead, for example through the app's own state hook and a controlled channel in the main process (enabled only by an environment variable or flag, for example a named pipe or stdin and stdout, not a network port), with screenshots from `webContents.capturePage`, or `--remote-debugging-pipe` if it works with the fuses. Report what works, what it costs in code, and whether it weakens the hardening (an automation channel in a shipped binary is itself a security surface; say how you limited it).
- **E4. Memory levers, as a separate table.** Do not change the baseline numbers. Separately, measure what a reasonable production configuration could shave off with the same PSS method (for example fewer renderer processes, limiting the V8 heap, GPU process settings, disabling features the app does not use) and state each lever's trade-off honestly, including any that change rendering or safety. Say what the practical floor looks like for this app.
- **E5. Loose ends.** Identify the five moderate `npm audit` findings (which packages, whether they ship in `app.asar` or are dev-only). Test the ASAR integrity fuse on Windows and report whether it works. Say whether the donut centre label problem is a library limitation or a mistake of yours. For Windows, check if the release build keeps the Chromium sandbox on.
- **E6. Dependency facts you did not check.** For Fluent UI React, TanStack Virtual, ECharts and Electron itself: date of last release, commits by how many people in the last 12 months, open issue counts, and who funds or maintains them, with links. Be explicit about what is single-maintainer.

When you finish each item, commit and push. Finish with a summary of what changed in the picture compared with `RESULTS.md`.
