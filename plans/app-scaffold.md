# Plan: App scaffold

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-12 |

## Goal

Replace the placeholder .NET scaffold with the TypeScript workspace the architecture describes, so the repository matches its documentation and feature work can start. The result is a small but real application: a hardened Electron window showing the app shell, a core package with the first domain types and tests, a host interface with a mock, a command-line tool, all four kinds of test, and CI and Dependabot for npm. There are no product features in this plan.

## Scope

- In: removing the .NET scaffold and its CI; the workspace and tooling; the `core`, `host-api`, `renderer`, `cli` packages and the `desktop` app; the hardening and privacy baseline of AD-18 for the shell; one end-to-end smoke test; CI, Dependabot and the README commands; filling in the `key_files` of the arc42 sections.
- Out: any domain feature (accounts, import, categorization and the rest); the budget file format implementation; the full privacy capture, the host implementations beyond a stub, and the web check (the [Electron foundations plan](electron-foundations.md)); signing; Linux.

## Approach

The selection slice on `spike/slice-electron` is reference only: read its hardening code, tests, scripts and workflows for lessons, and write the scaffold fresh. Copying it wholesale would carry the spike's shortcuts (fixture-path hacks, a test build that differs from the shipped one, hard-coded sizes) into the real history. Decisions are in [AD-14](../knowledge/architecture/09_architecture_decisions.md#ad-14-package-layout-ui-state-and-testing) (layout and test kinds), AD-15 (design system), AD-16 (testing), AD-18 (hardening) and AD-19 (host interface). Affected arc42 sections: 02, 04, 09. Conventions are in [project-standards.md](../project-standards.md).

## Milestones

### 1. Remove the .NET scaffold and set up the workspace

- Does: delete `src/`, `tests/` (the .NET projects and solution files), `Folio.slnx`, `Directory.Build.props`, `Directory.Packages.props`, `global.json`, `scripts/install-dotnet.sh`, the .NET workflows (`ci.yml`, `nightly.yml`, `avalonia-watch.yml`, `update-lockfiles.yml`) and the NuGet Dependabot ecosystem; replace the C# `.editorconfig` and `.gitignore` content. Add the root `package.json` with workspaces, the lockfile, the package manager settings (install scripts blocked unless allowlisted, a minimum release age), `tsconfig.base.json`, the Node version pin, ESLint and the formatter configuration, and `dependency-cruiser` configuration holding the AD-14 boundary rules.
- Acceptance criteria: no .NET file remains; installing from the lockfile works on Windows, macOS and Linux runners; type checking, lint and the formatter check pass on empty packages; a deliberate boundary violation (for example `core` importing `node:fs`) fails the architecture check.
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
- Acceptance criteria: the smoke test passes on Windows and macOS runners; started without `FOLIO_AUTOMATION=1`, the binary refuses a debugging switch; the packaged app contains only bundled code, no `node_modules`.
- Verified by: the end-to-end run in CI and a guard test.

### 5. The command-line tool

- Does: `packages/cli` with a Node `folio` entry point over the core: a `status` command and a `check` command that load a `.folio` fixture through a Node `FileStore`. A test runs it in a child process.
- Acceptance criteria: it runs with no display; it imports the same core as the app.
- Verified by: an integration test.

### 6. CI, Dependabot and documentation

- Does: workflows that run lint, the formatter check, type checking and the architecture check first, then unit, integration and end-to-end tests (Linux for the fast kinds, Windows and macOS for the end-to-end kind), with third-party actions pinned to commit SHAs. Dependabot for npm and GitHub Actions with grouped updates (Electron in its own group; patch and minor groups for the rest) and the existing auto-merge of the patch group, which still waits on the required checks. The README commands, the `key_files` of arc42 sections 02, 04 and 09 and the performance brief updated to the real files.
- Acceptance criteria: a pull request runs everything green; the repository's required checks are updated to the new job names (a repository setting only the owner can change).
- Verified by: a green run on the scaffold pull request and a Dependabot test update.

## Requirements

- Security: AD-18 applies to the shell from the first commit; imported files and IPC input are untrusted.
- Logging: a small logger in the main process with levels; no financial data in any log.
- Licences: a CI check for MIT-or-equivalent dependencies.

## Open questions

- Package manager: npm workspaces (what the slice used; scripts and release-age settings must be turned on explicitly) or pnpm with the hoisted linker (strict defaults, but its default layout breaks Electron's packaging tools). [Jeremy, before milestone 1]
- Formatter and linter: Prettier with ESLint, or Biome. [Jeremy, before milestone 1]
- Renderer tests: a simulated DOM (jsdom or happy-dom) for component unit tests. [Engineer, at milestone 3]
- Where the core runs in the desktop app: the renderer, or a worker. [Engineer, at milestone 3]
- The packager and installer tooling: `@electron/packager` with `@electron/fuses` plus electron-builder, or Electron Forge. [Engineer, at milestone 4]
- The Node version to pin for tooling. [Engineer, at milestone 1]
