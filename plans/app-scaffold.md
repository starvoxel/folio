# Plan: App scaffold

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-12 |

## Goal

Replace the placeholder .NET scaffold with the TypeScript workspace the architecture describes, so the repository matches its documentation and feature work can start. The result is a small but real application: a hardened Electron window showing the app shell, a core package with the first domain types and tests, a host interface with a mock, all four kinds of test, and CI and Dependabot for npm. There are no product features in this plan.

## Scope

- In: removing the .NET scaffold and its CI; the workspace and tooling; the `core`, `host-api` and `renderer` packages and the `desktop` app; the hardening and privacy baseline of AD-18 for the shell; one end-to-end smoke test; CI, Dependabot and the README commands; filling in the `key_files` of the arc42 sections.
- Out: any domain feature (accounts, import, categorization and the rest); the budget file format implementation; the full privacy capture, the host implementations beyond a stub, and the web check (the [Electron foundations plan](electron-foundations.md)); signing; Linux.

## Approach

The selection slice on `spike/slice-electron` is reference only: read its hardening code, tests, scripts and workflows for lessons, and write the scaffold fresh. Copying it wholesale would carry the spike's shortcuts (fixture-path hacks, a test build that differs from the shipped one, hard-coded sizes) into the real history. Decisions are in [AD-14](../knowledge/architecture/09_architecture_decisions.md#ad-14-package-layout-ui-state-and-testing) (layout and test kinds), AD-15 (design system), AD-16 (testing), AD-18 (hardening) and AD-19 (host interface). Affected arc42 sections: 02, 04, 09. Conventions are in [project-standards.md](../project-standards.md).

## Milestones

### 1. Remove the .NET scaffold and set up the workspace

- Does: delete `src/`, `tests/` (the .NET projects and solution files), `Folio.slnx`, `Directory.Build.props`, `Directory.Packages.props`, `global.json`, `scripts/install-dotnet.sh`, the .NET workflows (`ci.yml`, `nightly.yml`, `avalonia-watch.yml`, `update-lockfiles.yml`) and the NuGet Dependabot ecosystem; replace the C# `.editorconfig` and `.gitignore` content. Add the root `package.json` with workspaces, the lockfile, the npm 12 settings (`.npmrc` with `min-release-age=7`, `save-exact`, `engine-strict`, `strict-allow-scripts` and `strict-npmrc`; `allowScripts` in the root `package.json` listing only the packages whose install scripts are reviewed, starting with esbuild; `engines` requiring npm 12 and a Node release it supports), `tsconfig.base.json`, the Node version pin, ESLint (typescript-eslint, strict and type-checked) and Prettier configuration, and `dependency-cruiser` configuration holding the AD-14 boundary rules.
- Acceptance criteria: no .NET file remains; installing from the lockfile with `npm ci` works on Windows runners, and on macOS in the weekly run; an unreviewed dependency install script makes the install fail (`strict-allow-scripts`); type checking, lint and the formatter check pass on empty packages; a deliberate boundary violation (for example `core` importing `node:fs`) fails the architecture check.
- Verified by: a green CI run and the failing-on-purpose run shown in the pull request.

### 2. The core package

- Does: `packages/core` with the branded types of AD-7 (`Money`, `LocalDate`, `YearMonth`, ids) and their checked helpers, an injected `Clock`, a `Result` type, and a schema helper for boundary validation. Unit tests next to the code and fast-check properties for the money arithmetic (no overflow past a safe integer, add and subtract round-trip, parsing from decimal strings never goes through a float).
- Acceptance criteria: the properties pass; the core imports nothing from Node, the DOM, React or Electron (checked by the architecture rules); the test naming shape is enforced.
- Verified by: the unit and architecture runs in CI.

### 3. The host interface and the renderer shell

- Does: `packages/host-api` with the `HostApi` and `FileStore` interfaces and an in-memory mock. `packages/renderer` with the app shell from the design notes (navigation, top bar with the placeholder controls, light and dark themes, a settings page with one confirmation dialog), Fluent UI components behind `ui/fluent/` (AD-15), a stable `data-testid` convention, and placeholder pages. Built with Vite.
- Acceptance criteria: the shell renders in light and dark; Fluent is imported only under `ui/fluent/` (checked); every interactive control has an accessible name; an integration test loads the built renderer in a real browser engine with the mock host and visits every page.
- Verified by: the integration run in CI and screenshots in the pull request.

### 4. The desktop app

- Does: `apps/desktop` with the Electron main process and preload bridge implementing the hardening of AD-18 (custom protocol, content security policy, deny-all request filter and permissions, no crash reporter or updater, `--no-proxy-server`, spellcheck language list emptied, fuses), the `FOLIO_AUTOMATION` hook and the debugging guard of AD-16, and unsigned packaging for Windows and macOS (AD-20). One end-to-end smoke test: Playwright launches the packaged release binary through the debugging pipe, visits every page, reads the state hook, takes a screenshot, opens and closes the dialog (focus inside, Escape closes), and exits cleanly.
- Acceptance criteria: the smoke test passes on Windows runners and in the weekly macOS run; started without `FOLIO_AUTOMATION=1`, the binary refuses a debugging switch; the packaged app contains only bundled code, no `node_modules`.
- Verified by: the end-to-end run in CI and a guard test.

### 5. CI, Dependabot and documentation

- Does: workflows that run lint, the formatter check, type checking and the architecture check first, then unit, integration and end-to-end tests (Windows for every kind; macOS on a weekly schedule; Linux only for the privacy capture of the Electron foundations plan), with third-party actions pinned to commit SHAs. CI installs npm 12 explicitly (`npm install -g npm@12`, because no stable Node bundles it yet), then runs `npm ci` and `npm audit signatures`, and runs `npx playwright install --with-deps chromium` in the integration job, which is the one that launches a Playwright browser. Dependabot for npm and GitHub Actions with a `cooldown` of seven days to match `min-release-age`, and grouped updates (Electron in its own group; patch and minor groups for the rest) and the existing auto-merge of the patch group, which still waits on the required checks. The README commands, the `key_files` of arc42 sections 02, 04 and 09 and the performance brief updated to the real files.
- Acceptance criteria: a pull request runs everything green; the repository's required checks are updated to the new job names (a repository setting only the owner can change).
- Verified by: a green run on the scaffold pull request and a Dependabot test update.

## Requirements

- Security: AD-18 applies to the shell from the first commit; imported files and IPC input are untrusted.
- Logging: a small logger in the main process with levels; no financial data in any log.
- Licences: a CI check for MIT-or-equivalent dependencies.

## Decisions

- Formatter and linter: Prettier with ESLint using typescript-eslint's strict, type-checked configuration. It is also what ai-foundation's standards describe, and it has the deepest rule set for agent-written code (Jeremy, 2026-11-13). Biome stays a later option once its type-aware and React coverage match.

- Package manager: npm 12 workspaces with the hardened settings above (Jeremy, 2026-11-13). npm 12 blocks dependency lifecycle scripts by default and skips them quietly unless `strict-allow-scripts` is set; workspace packages and the root project's own scripts are not blocked. No stable Node bundles npm 12 yet (Node 26 LTS bundles npm 11.20), so it is installed explicitly. Electron 42 and later has no install script; only esbuild needs an `allowScripts` entry, and Playwright's browsers come from a separate install command. pnpm remains the alternative (it fails on unreviewed scripts by default, but Electron's packaging tools need its hoisted linker).
- Unit tests sit next to the code, as in AD-14 (Jeremy, 2026-11-13).
- TypeScript 6.0.x for now: typescript-eslint (decided above) does not support TypeScript 7, so the pinned 7.0.x waits (Engineer, milestone 1; recorded in 02_constraints.md).
- Dependabot groups and security: packages that must move together share a named group, enforced by an architecture test; security updates are on and use their own groups, with Electron separate; only the `patches` group is auto-merged; TypeScript is held below 6.1 until typescript-eslint supports it (Jeremy and Engineer, 2026-11-13; 02_constraints.md updated).
- Test platforms: pull-request CI runs every kind on Windows. macOS runs the whole chain weekly and on demand (`macos-weekly.yml`), and Linux, which is not a v1 platform, is left to the AD-18 capture job. `.gitattributes` forces LF so the formatter check passes on Windows checkouts (Jeremy, 2026-11-13).
- Node for tooling: `.node-version` pins Node 26 LTS, taken at its newest release (security fixes ship as point releases, so the seven-day wait does not apply to Node itself); `engines` allows `^22.23.4 || ^24.15.0 || >=26.0.0`, the intersection of npm 12's range and the ai-foundation Node baseline (Engineer, milestone 1).
- Simulated DOM for component tests: jsdom, selected per test file with a `@vitest-environment jsdom` comment, with Testing Library. jsdom is what Fluent's own tests use; component tests are `*.test.tsx` (Engineer, milestone 3; AD-14 and project-standards.md updated).
- Where the core runs: the renderer's main thread for now; a worker stays possible and is left to the performance initiative (Engineer, milestone 3; AD-19 updated).
- Integration build: the renderer is built with Vite using a mock-host entry (`tests/integration/support/mock-app`) that calls the same `mountApp` as the shipped entry, then served from loopback to a real Chromium (Engineer, milestone 3).
- CI browser download: `npx playwright install --with-deps chromium` runs in the integration job, where Playwright launches its own Chromium. The end-to-end job does not run it, because those tests attach to the packaged app's own Chromium and never launch a Playwright browser (Engineer, milestone 5; the milestone text is adjusted).
- Licence check: an architecture test over `package-lock.json` (`tests/architecture/licences.test.ts`) with recorded exceptions in `licence-exceptions.json`; it runs in the architecture step of CI (Engineer, milestone 5).
- Packaging: `@electron/packager` with `@electron/fuses` builds the unsigned app folder that the end-to-end tests drive. The installer tool (NSIS, disk image) belongs to the install-experience milestone of the Electron foundations plan, so electron-builder is not a dependency yet (Engineer, milestone 4; AD-20 updated).
- Main-process bundle: Vite builds the main process and the preload script into single CommonJS files with every dependency inlined, so the app archive holds no node_modules; a package-contents test checks it (Engineer, milestone 4).
- File headers: the javascript_base header block is required on every `.ts`, `.tsx`, `.js`, `.mjs` and `.cjs` file, enforced by a local ESLint rule (`tools/eslint/folio-plugin.js`) because the TypeScript standards are not written yet (Engineer, milestone 1).

## Open questions
