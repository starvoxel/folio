# Folio

A desktop app a household opens once a month to import every account's transactions from CSV, check them, and see where the money went, how it compares to normal, and how net worth is moving. Closing a month locks its numbers so they stop moving.

Financial data stays in a budget file on your own computers. There are no bank logins and nothing leaves the file unless you opt in.

## Status

The product requirements and architecture are decided, and the application scaffold from the [app scaffold plan](plans/app-scaffold.md) is in place: an npm workspace with the `core` package (money, dates, ids, clock, boundary validation), the `host-api` interface with a mock, the `renderer` shell (navigation, top bar, light and dark themes, Settings with a confirmation dialog, placeholder pages) and the hardened Electron `desktop` app, with all four kinds of test. There are no product features yet.

## Stack

Electron with React and TypeScript, Fluent UI React v9 for components, TanStack Virtual for large tables and ECharts for charts. The domain core is plain TypeScript with no Node, DOM or Electron imports, so the same code can later serve a read-only web build. Tests use Vitest, fast-check, dependency-cruiser and Playwright. Windows and macOS are the v1 platforms. The reasoning is in [AD-17](knowledge/architecture/09_architecture_decisions.md#ad-17-electron-with-typescript-is-the-stack) and the research behind it in [knowledge/research/](knowledge/research/). Coding standards come from ai-foundation, configured in [.aiconfig.json](.aiconfig.json); [project-standards.md](project-standards.md) holds only Folio's test conventions.

## Build and test

You need Node 26 LTS (see `.node-version`) and npm 12. No stable Node bundles npm 12 yet, so install it once with `npm install -g npm@12`. The repository's `.npmrc` is strict on purpose: dependency install scripts are blocked unless `allowScripts` in `package.json` lists them, and new releases must be seven days old.

```
npm ci                    # install from the lockfile
npm run check             # lint, formatter check, type check, architecture tests
npm run test:unit         # unit tests, next to the code as *.test.ts
npm run test:integration  # real Chromium and real folders (run "npx playwright install chromium" once; add --with-deps on Linux)
npm run package           # build the desktop app and package it (unsigned) into apps/desktop/release
npm run test:e2e          # drive the packaged app; run "npm run package" first
npm test                  # everything, in CI order
npm run format            # fix formatting
npm run depcruise         # the boundary rules from the command line, for readable output while debugging
```

`npm run test:architecture` runs the boundary rules (dependency-cruiser, through its API, over the real tree and over deliberate-violation fixtures), the test placement, file naming and test-shape checks, and the licence check. On Linux the end-to-end tests need a display, for example `xvfb-run -a npm run test:e2e`, and a Linux machine whose Chromium sandbox is not configured gets `--no-sandbox` for those tests only; CI runs every kind on Windows, and the whole chain on macOS once a week. If Playwright's Chromium is somewhere unusual, set `FOLIO_CHROMIUM_PATH`. The packaged app can be driven only when started with `FOLIO_AUTOMATION=1` (AD-16).

### Kinds of test

There are four kinds of test, decided by the most expensive resource a test touches. Each runs on its own:

- _Unit tests_ run in memory, in one process, with no real file system, network, Electron or browser engine.
- _Integration tests_ stay on one machine and may use real temporary folders, the real host adapter and a real browser engine for the renderer.
- _Architecture tests_ check structural rules of the codebase itself, such as package boundaries.
- _End-to-end tests_ drive the packaged app in a real window with Playwright.

The full rules for test kinds, layout and naming are in [project-standards.md](project-standards.md). Performance and stress testing are a separate initiative.

## Cloud sessions

`scripts/install-node.sh` installs the pinned Node 26 LTS (checksum-verified) and npm 12, as the .NET install script once did for the SDK. It is idempotent, always exits 0 and logs what it did. The session-start hook runs it in cloud sessions and puts the pinned Node first on `PATH`. Set this as the environment's setup script (it runs as root after the repository is cloned, in the folder that holds the checkouts):

```bash
#!/bin/bash
# Folio: pinned Node 26 and npm 12, Xvfb and Electron's Linux libraries, then the locked install.
if [ -d folio ]; then
  (
    cd folio || exit 0
    FOLIO_INSTALL_E2E_DEPS=1 bash scripts/install-node.sh
    # The image's own Node (/opt/node22/bin) is earlier on PATH than /usr/local/bin, so the pinned
    # one must be put first or npm ci runs on the wrong Node and npm.
    export PATH="/usr/local/lib/nodejs/bin:$PATH"
    npm ci
    npx playwright install --with-deps chromium
  )
fi
```

The environment's network needs `nodejs.org`, `github.com` and `objects.githubusercontent.com` (the Electron download), `cdn.playwright.dev` (the integration tests' Chromium) and `tuf-repo-cdn.sigstore.dev` (`npm audit signatures`); package registries are allowed by default. Run the end-to-end tests there with `xvfb-run -a npm run test:e2e`.

## Documentation

| Where                                                                          | What                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [knowledge/product/month-end-review.md](knowledge/product/month-end-review.md) | Product requirements overview, with one linked doc per feature area                                                           |
| [project-standards.md](project-standards.md)                                   | Folio-specific conventions (the kinds of test) on top of the ai-foundation standards                                          |
| [knowledge/architecture/](knowledge/architecture/)                             | arc42 architecture docs; decisions are in [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md) |
| [knowledge/research/](knowledge/research/)                                     | Research briefs, including the stack comparison                                                                               |
| [plans/](plans/)                                                               | Implementation plans                                                                                                          |
