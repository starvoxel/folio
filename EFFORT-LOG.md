# Effort log (Electron slice)

Timestamps are UTC. Start: 2026-11-11T23:50Z (session start, branch checked out, spec read).

| Time | Entry |
| ---- | ----- |
| 23:50 | Checked out `spike/slice-electron`. Read SLICE-SPEC, README, RESULTS-TEMPLATE, design and shell notes, research brief section 9. Unpacked the prototype bundle to read its tokens (accent #0078D4, palette, light/dark ramps). |
| 23:55 | `npm install` of electron 45.3.0 succeeded but the Electron binary was NOT downloaded (postinstall did not run in this sandbox). Ran `node node_modules/electron/install.js` by hand; worked. |
| 23:58 | Dropped TanStack Table: v9.3.1 is a new API generation; sort/filter for one table is ~40 lines. Using TanStack Virtual only. Recording this as "built ourselves". |
| 00:20 | Wrote main (hardening, folio:// protocol with per-load CSP nonce), sandboxed preload (2 invoke calls), React/Fluent renderer, virtualized grid (TanStack Virtual, own sort/filter), ECharts SVG donut and bars, automation API. First launch under Xvfb with `--no-sandbox`: no CSP violations in the console, 10,000 rows load. |
| 00:22 | TypeScript 7.0.2 (native) rejects `moduleResolution: node10`; switched main tsconfig to Node16. |
| 00:25 | A single big heredoc bash command was refused by the harness safety check even though it contained no `rm`; wrote files with the Write tool instead. |
| 00:35 | Packaged with @electron/packager + @electron/fuses. Playwright could NOT attach to the fuse-hardened binary: `EnableNodeCliInspectArguments=false` makes `_electron.launch` time out (20 s). With that fuse on, attach works (400 ms). Decision: test binary = release binary with only that fuse flipped (separate out dir); CI compares the two executables byte for byte. |
| 00:40 | Embedded ASAR integrity fuse: enabling it on Linux changed nothing observable (documented as macOS/Windows only); left off by default. |
| 00:45 | First perf run: frames fine, sorts ~31 ms, but memory over the gate (RSS sum 662 MB, PSS 412 MB). Measured a baseline (Overview page, with/without GPU process) before touching anything; not tuning the measurement. |
| 00:50 | `ip link add type dummy` not supported by this sandbox kernel; used a veth pair for the "sink" namespace instead. apt-get needed `apt-get update` before installing iproute2/tcpdump. |
| 00:55 | Idle-capture driver failed once: my search term ("coffee") matched no description, so `.grid-row` never appeared. Changed the term to "sobeys". |
| 01:05 | G1 captures done (veth "sink" namespace + tcpdump + strace; positive control with curl is detected). Driven run (every page, five minutes idle): only loopback, 0 non-loopback packets. Release binary idle in loopback-only namespace: 0 packets, 0 AF_INET connects. Stock unhardened Electron: also 0 outbound attempts (the brief's spellcheck-dictionary leak did not reproduce here). |
| 01:15 | a11y: ECharts' auto `aria` label overwrote my chart label and read raw cents ("data for Housing is 2708950"). Disabled ECharts aria; kept my own label + legend/table as the accessible data. |
| 01:35 | CI run 1: Linux slice tests 16/16 twice, but my screenshot-compare step failed: Playwright wipes `test-results/` at the start of each run, deleting run 1's screenshots. Moved the kept run-1 shots outside `test-results`. Release vs test executable differ by exactly 1 byte (the inspect fuse). |
| 01:40 | Dark mode: Fluent nav items painted opaque black; overrode to transparent. |
