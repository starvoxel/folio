# Folio Electron slice (stack-selection spike)

Throwaway. Electron 45 + TypeScript (strict) + Vite + React 19 + Fluent UI React v9. See `../RESULTS.md` for the findings.

```bash
cd electron
npm ci
node node_modules/electron/install.js        # only if the Electron binary was not downloaded by npm
npm run typecheck && npm run test:unit
node scripts/package.mjs                      # release build (fuses hardened) -> out/
FOLIO_FUSE_INSPECT=1 FOLIO_OUT=out-test node scripts/package.mjs   # test build: identical except the Node inspect fuse
xvfb-run -a npx playwright test               # Linux; plain `npx playwright test` on Windows
```

Run the app by hand (data directory is required):

```bash
out/Folio-linux-x64/Folio --no-sandbox --data-dir=../fixtures     # or set FOLIO_DATA_DIR
```

Automation (agent-drivable) is off unless `FOLIO_AUTOMATION=1`. Then the renderer exposes `window.__folio` with
`getState()`, `navigate(page)` and `settled()`; Playwright reads it through `page.evaluate`. See `src/renderer/automation.ts`.

Layout: `src/main` (hardening, `folio://` protocol, IPC), `src/preload` (two-function bridge), `src/renderer` (UI),
`src/shared` (types, validation, money formatting), `tests` (Playwright), `scripts` (packaging, capture, comparison).
