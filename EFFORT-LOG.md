# Effort log (Tauri slice)

Times are UTC, 2026-11-12. Prompts or corrections from the user after the kickoff prompt: 0 so far.

- Start: read specs and Electron results. Sandbox is Ubuntu 24.04 with apt and crates.io access, so Tauri builds locally.
- Dispatched 3 read-only research agents (wry settings, WebView2/bundler/CEF docs, tracker/testing tools). Results are unverified; claims used in results are marked and checked.
- Scaffolded `tauri/`: copied Electron renderer, replaced preload bridge with `HostApi` + Tauri adapter, 4 Rust commands.
- Build 1 failed: missing `serde` dependency for the derive. Fixed.
- First run under Xvfb: blank white window. Suspected upstream WebKitGTK/Xvfb bug (tauri#15936) and tried DMABUF/compositing/software-GL env vars; none changed anything. Real cause found by injecting a diagnostic script: `app.security.freezePrototype: true` made a library assign to a read-only property, so the bundle never ran. Removed it. Lesson: this hardening option breaks the Fluent/React/ECharts bundle.
- Second failure: `invoke` of a raw `Response` returns an ArrayBuffer, not a string. Fixed in the adapter.
- Slice renders on Linux with no graphics workaround needed in this sandbox.
- Mistake: committed tauri/e2e/node_modules (14.5k files, ~7 MB packed). Removed from the index in the next commit; history still contains it because a force-push was not allowed. A reviewer may squash.
- CI run 1: bundling failed everywhere: tauri rejects bundle.category 'Office' (valid: e.g. Finance). Fixed.
- Found: on the hosted ubuntu-24.04 runner the shipped binary stalls ~25 s before mapping its window (D-Bus default timeout; runner has /run/user/1001/bus but no DBUS_SESSION_BUS_ADDRESS). Under dbus-run-session or with no bus it takes 1 s. Evidence: tauri/evidence/ci/diag. Earlier 'no web view' captures of the shipped binary on CI were this stall (10-15 s waits).

## Later entries (UTC, 2026-11-12)

- 16:18 First end-to-end scenario through the embedded WebDriver on Linux: 11 of 16 pass. Failures were driver limits, not app bugs: select commands do not fire React's change event, `keys('Tab')` is synthetic (isTrusted=false) and does not move focus, `getWindowSize()` returns 0x0. Fixed with a script-dispatched change event and OS-level key injection (xdotool; later SendKeys on Windows, osascript on macOS).
- 16:25 First CI run: bundling failed on all three OSes (`bundle.category` "Office" invalid). The "Sizes" step then died on `set -e` with a missing `.exe`. Reading results through job-log tails was too lossy, so each job now commits its own result files to the branch (`scripts/ci-commit.sh`). That script then failed differently per OS: `cp --parents` is not on macOS (switched to tar); on Windows `git pull --rebase` refused because of CRLF noise (autostash and `core.autocrlf=false`). Each failure cost one 25 to 40 minute CI round.
- 16:40 Local F1 runs (sandbox): the full scenario timed out at the 2 min mocha default during the 60 s idle; raised the mocha timeout.
- 16:55 Linux shipped binary showed no web view on CI. Diagnosed with a diagnostic workflow (`tauri-diag.yml`): a 25 s start-up stall under the runner's default D-Bus environment; fixed in the launch scripts with `dbus-run-session`. First hypothesis (bubblewrap sandbox failing under the AppArmor userns restriction) was wrong: WebKitGTK is not sandboxed in these apps at all.
- 17:10 The CI "no web view" captures of the shipped binary were therefore taken during the stall; rerun with the fix.
- 17:35 macOS first run: 14 of 15; the dialog test returned DOM objects from `executeAsync`, which WKWebView refuses; fixed (`.then(() => done())`). The 1.57% screenshot mismatch in that run was caused by the failed test's leftover state.
- 17:55 Windows privacy job failed in 1 s: `(cd e2e; npm ci)` is not valid PowerShell. Fixed. Windows slice evidence also did not push (CRLF). Both fixed; a full rerun gave the numbers in RESULTS.md.
- 18:45 Windows sampler found an outbound HTTPS connection from the WebView2 process in every configuration. Added a registry-policy variant, a reverse lookup and pktmon summaries (the raw pktmon text was 4 to 18 MB and was committed once by mistake in `tauri/evidence/ci/windows-privacy`; removed from the index afterwards, still in history).
- Mistakes: committed `tauri/e2e/node_modules` once (removed from the index; history keeps it, about 7 MB packed, force-push was not permitted); wrote `RESULTS.md` first with "about 7 hours" and a made-up CI run number, caught and corrected before commit of the final text; first draft of the CI workflow had a cache action SHA written from memory, replaced with the SHA already pinned in the Electron workflow.
- Prompts or corrections from the user after the kickoff: **0** (two status check-ins, no change of direction).
- Research agents (approved, read-only): 3 (wry settings; WebView2 and bundler docs and CEF status; tracker and testing tools). What I re-checked and what I did not is in `TAURI-FINDINGS.md` section 3.
