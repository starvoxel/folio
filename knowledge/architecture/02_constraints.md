---
section: '02'
title: 'Architecture Constraints'
lifecycle: draft
tags: [constraints, stack, standards]
key_files:
  - package.json
  - .npmrc
  - .node-version
  - tsconfig.base.json
  - eslint.config.js
  - licence-exceptions.json
  - tests/architecture/licences.test.ts
  - apps/desktop/package.json
  - packages/renderer/package.json
---

> The fixed choices the architecture works within: platform, pinned stack, coding standards and product rules.

## Technical constraints

| Constraint   | Detail                                                                                                                                                                                                                                                                                                                                                                 | Source                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Platform     | Desktop app on Windows and macOS. Linux is not a v1 target. A read-only web version and a server-backed data store are wanted later; neither is built in v1                                                                                                                                                                                                            | PRD constraints; decision 2026-11-12 |
| UI           | Electron, with React and TypeScript, and Fluent UI React v9 for components (AD-17, AD-15)                                                                                                                                                                                                                                                                              | Decision, 2026-11-12                 |
| Runtime      | The Chromium and Node that ship inside Electron, pinned exactly. Electron releases a major roughly every two months, so updates are monthly work behind the regression suite (AD-18)                                                                                                                                                                                   | Research, 2026-11-12                 |
| Storage      | One local budget file opened like a document; may sit in a shared or synced folder                                                                                                                                                                                                                                                                                     | PRD constraints                      |
| Data sources | CSV only; no bank connections                                                                                                                                                                                                                                                                                                                                          | PRD constraints                      |
| Network      | None by default; online lookups are opt-in and limited to services that neither keep nor sell data. The app opens no listener                                                                                                                                                                                                                                          | PRD H1.12                            |
| Currency     | One currency, in dollars and cents; all accounts are assumed to use the same currency. Exact integer cents, no floating-point arithmetic on money                                                                                                                                                                                                                      | PRD assumption 2                     |
| Concurrency  | One editor at a time; two simultaneous editors are not handled                                                                                                                                                                                                                                                                                                         | PRD constraints                      |
| Licences     | All dependencies MIT or equivalent (Apache-2.0, ISC, BSD, 0BSD); no paid components. A licence check runs in CI with the architecture tests (`tests/architecture/licences.test.ts`). Any other licence needs a recorded decision, kept in `licence-exceptions.json`                                                                                                    | Decision, 2026-11-05                 |
| Distribution | Household only for v1: unsigned installers are acceptable (Windows SmartScreen and macOS Gatekeeper will warn), and there is no auto-update (AD-20)                                                                                                                                                                                                                    | Decision, 2026-11-12                 |
| Build tools  | npm 12 workspaces, hardened: dependency install scripts are blocked unless listed in `allowScripts` (npm 12's default), new releases wait seven days (`min-release-age`), CI installs from the lockfile with `npm ci` and checks signatures. No stable Node bundles npm 12 yet, so CI and developers install it explicitly. These matter because the npm tree is large | Research, 2026-11-13                 |

## Pinned stack

Versions are exact and live in the root `package.json` files and the lockfile, set by the scaffold plan ([app-scaffold.md](../../plans/app-scaffold.md)). The versions below are what the stack-selection slice measured on 2026-11-12 and are the starting pins.

| Package                              | Version in the slice                                 |
| ------------------------------------ | ---------------------------------------------------- |
| Electron                             | 45.3.x (Chromium 156)                                |
| TypeScript                           | 6.0.x, strict (see the note below)                   |
| Vite                                 | 8.3.x                                                |
| React                                | 19.3.x                                               |
| `@fluentui/react-components`         | 9.75.x                                               |
| `@tanstack/react-virtual`            | 3.14.x                                               |
| ECharts                              | 6.1.x                                                |
| Playwright                           | 1.65.x                                               |
| fast-check                           | 4.x                                                  |
| fflate (zip)                         | 0.8.x                                                |
| Electron fuses and packaging tooling | `@electron/fuses` 2.1.x, `@electron/packager` 20.3.x |

TypeScript is 6.0.x, not the 7.0.x of the slice, because the linter the project chose needs the TypeScript 6 JavaScript API: typescript-eslint 8.72 declares `typescript <6.1.0` and TypeScript 7 (the native compiler) does not ship that API yet. Moving to 7 waits for typescript-eslint support; type checking and the build are otherwise unaffected. Tooling runs on Node 26 LTS (`.node-version`), always the newest release of that line because Node ships its security fixes as point releases; `engines` accepts Node 22.23.4 and later within npm 12's supported ranges.

## Organizational constraints: coding standards

The project follows the ai-foundation standards for its stack, configured in `.aiconfig.json`. Language and stack conventions live only in ai-foundation, never in this repository. Until ai-foundation has TypeScript, React and Electron standards, the existing `javascript_base` and `javascript_node` standards apply, and writing the missing ones is an open task for the ai-foundation project. [project-standards.md](../../project-standards.md) holds only Folio-specific conventions: the kinds of test and their layout and naming.

The build enforces what it can: strict compiler settings, lint with warnings as errors, a formatter check, and boundary rules between packages (AD-14).

## Product rules that act as constraints

- A locked month changes only through the guarded reopen (M1.7, M1.14, H1.8).
- Months close in order (M1.17).
- Closing, reopening and completing an import save immediately (H1.6b).
