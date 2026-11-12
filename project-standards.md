# Project standards: Folio

Folio's implementation conventions. ai-foundation loads this file after the general standards it resolves from `.aiconfig.json` (`javascript_base`, `javascript_node`), and where they disagree this file wins. ai-foundation has no TypeScript, React or Electron standards yet, so the language-level rules below are written to be moved there; a proposal is in [knowledge/research/typescript-standards-proposal.md](knowledge/research/typescript-standards-proposal.md).

Rules that have another owner are not repeated here: the stack and pinned versions (`package.json` and the lockfile, [02_constraints.md](knowledge/architecture/02_constraints.md)), architecture decisions such as package boundaries and Fluent isolation (each enforced by its own architecture check, [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md)), product requirements such as menus (`knowledge/product/`), and generic JavaScript rules (the ai-foundation standards).

---

## TypeScript conventions

These sit on top of `javascript_base` and `javascript_node`. Where this section disagrees with them, this section wins. The style basis stays the Airbnb guide those standards cite: 2-space indent, single quotes, required semicolons, trailing commas on multi-line literals, about 100 characters per line, named exports, arrow functions for callbacks, `function` declarations for top-level exported functions, `async`/`await`, and `throw` only `Error` subclasses with a `cause` when wrapping.

### Language

- TypeScript in strict mode, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `noImplicitOverride`. Files are `.ts` and `.tsx`.
- No `any`. Use `unknown` at boundaries (parsed JSON, IPC messages, file contents) and narrow it with a schema before use. Avoid type assertions; a justified one carries a comment saying why it is safe.
- Explicit return types on exported functions and on public members of exported classes. Local variables use inference.
- Prefer `readonly` data and immutable updates. Model closed sets with string-literal unions or discriminated unions, not `enum`.
- Domain quantities have branded types: `Money` (integer cents), `LocalDate`, `YearMonth` and entity ids (AD-7). Floating-point arithmetic on money is forbidden, and `Date` is not used in the domain.
- Expected failures are returned as values (a discriminated `Result`); exceptions are for bugs and unrecoverable states.
- TSDoc (`/** … */`) on exported members, without repeating types the signature already states. `@throws` where a function intentionally throws.
- Every `.ts` and `.tsx` file starts with the same header block that `javascript_base` requires for `.js` files.

### Modules and layout

- Node-side code (the Electron main process, the CLI, tools) follows `javascript_node`, including the `node:` prefix and `.js` extensions in relative imports. Renderer code uses the bundler's resolution without extensions.
- Packages and their allowed imports are fixed by AD-14 and enforced by dependency-cruiser: `core` imports nothing from Node, the DOM, React or Electron; the renderer never imports Electron or Node; the main process never imports React; Fluent UI is imported only under `renderer/src/ui/fluent/`.
- One primary export per file; named exports; no default exports except where a tool requires one.

### React

- Function components and hooks only. Components stay thin: logic with more than a trivial test belongs in `core` or in a small pure module.
- App state comes from the core store through `useSyncExternalStore`. Effects are a last resort, not a place for business rules.
- Every interactive control has an accessible name, and every control a test tool must find has a stable `data-testid`. Colours, spacing and type come from Fluent tokens, never hard-coded values (AD-15).

### Electron and security

- Context isolation on, Node integration off, sandbox on; the preload bridge exposes the smallest possible API and validates every message with a schema. Every IPC handler treats its input as untrusted.
- No remote content, no `eval` or `new Function`, a strict content security policy, deny-all permission handlers. The full list and its capture are AD-18.
- Imported files (CSV, `.folio`) are untrusted input: validate before use.

### Dependencies

- Licences are MIT or equivalent, checked in CI. No paid components.
- Dependency install scripts are blocked unless allowlisted; CI installs from the lockfile only; new releases wait a minimum age before adoption; third-party actions are pinned to commit SHAs.

### Tooling

- Formatter and linter are checked in CI: type-aware lint rules with warnings as errors, and a formatter check. The scaffold plan names the tools.

---

## Testing

These replace the test structure and naming in `javascript_node`.

### Kinds

A test's kind is decided by the most expensive resource it touches, not by how much code it covers.

| Kind         | Rule                                                                                                                                                                                                                                                     | Where                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Unit         | One process, same result every run. No real file system, network, Electron or browser engine; time comes from the injected `Clock`. A simulated DOM is allowed for component tests. Several real modules may work together if everything stays in memory | `*.test.ts` next to the code, run by Vitest |
| Integration  | One machine: real temporary folders on disk, the real host adapter, a real browser engine for the renderer, loopback                                                                                                                                     | `tests/integration/`, Vitest                |
| Architecture | Structural rules of the codebase itself (fitness functions)                                                                                                                                                                                              | `tests/architecture/`                       |
| End-to-end   | The packaged app in a real window, driven by Playwright                                                                                                                                                                                                  | `tests/e2e/`, Playwright                    |

- Property-based (fast-check), snapshot and sample-file tests are techniques, not kinds. They go wherever their resources put them, usually unit. Product rules such as "a locked month never changes" are ordinary unit or integration tests.
- Performance and stress testing are a separate initiative, not kinds of this setup.
- Tagging tests across kinds is not used yet.

### Layout

- Each kind runs on its own with its own command, and one command runs everything. CI runs architecture tests, then unit, then integration, then end-to-end.
- Unit tests are colocated as `{module}.test.ts`. The other kinds live under `tests/<kind>/`.
- Unit tests never import Electron, Playwright or the host adapters. Enforced by dependency-cruiser. The no-file-system and no-network rule is checked in review.

### Naming

Tests are named in three levels: `describe` the subject, `describe` the condition, `it` the expected result.

- Subject: the member under test (`parseAmount`, `ClosePage`). For architecture tests, the artefact being checked (`sourceFiles`, `packageImports`).
- Condition: the input, state or scope, as a noun phrase (`emptyInput`, `lockedMonth`, `coreAssembly`). Use `defaultState` when there is none.
- Expected result: a present-tense verb phrase (`returnsNoLines`, `throwsRangeError`, `importsNothingFromNode`).

Test files are named `{module}.test.ts`, and end-to-end files `{feature}.e2e.ts`. An architecture test enforces the three-level shape; review checks the wording.
