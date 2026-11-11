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
