# Project standards: Folio

Folio's implementation conventions. ai-foundation loads this file after the general standards it resolves from `.aiconfig.json`, and where they disagree this file wins. It holds only what is specific to Folio. Language and stack conventions (TypeScript, React, Electron and their tooling) belong in ai-foundation and are not repeated or overridden here.

Rules that have another owner are not repeated here: the stack and pinned versions (`package.json` and the lockfile, [02_constraints.md](knowledge/architecture/02_constraints.md)), architecture decisions such as package boundaries and design-system isolation (each enforced by its own architecture check, [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md)), product requirements such as menus (`knowledge/product/`), and generic language rules (the ai-foundation standards).

---

## Testing

These replace the test structure and naming in the ai-foundation standards.

### Kinds

A test's kind is decided by the most expensive resource it touches, not by how much code it covers.

| Kind         | Rule                                                                                                                                                                                                                                                     | Where                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Unit         | One process, same result every run. No real file system, network, Electron or browser engine; time comes from the injected `Clock`. A simulated DOM is allowed for component tests. Several real modules may work together if everything stays in memory | `*.test.ts` next to the code (`*.test.tsx` for component tests) |
| Integration  | One machine: real temporary folders on disk, the real host adapter, a real browser engine for the renderer, loopback                                                                                                                                     | `tests/integration/`                                            |
| Architecture | Structural rules of the codebase itself (fitness functions)                                                                                                                                                                                              | `tests/architecture/`                                           |
| End-to-end   | The packaged app in a real window, driven by automation                                                                                                                                                                                                  | `tests/e2e/`                                                    |

- Property-based, snapshot and sample-file tests are techniques, not kinds. They go wherever their resources put them, usually unit. Product rules such as "a locked month never changes" are ordinary unit or integration tests.
- Performance and stress testing are a separate initiative, not kinds of this setup.
- Tagging tests across kinds is not used yet.

### Layout

- Each kind runs on its own with its own command, and one command runs everything. CI runs the architecture tests first, then unit and integration tests in parallel, then end-to-end.
- Unit tests are colocated as `{module}.test.ts`, or `{module}.test.tsx` for component tests (AD-14 gives the reasons). The other kinds live under `tests/<kind>/`.
- Unit tests never import Electron, the end-to-end driver or the host adapters. Enforced by the architecture checks. The no-file-system and no-network rule is checked in review.

### Naming

Tests are named in three levels: `describe` the subject, `describe` the condition, `it` the expected result.

- Subject: the member under test (`parseAmount`, `ClosePage`). For architecture tests, the artefact being checked (`sourceFiles`, `packageImports`).
- Condition: the input, state or scope, as a noun phrase (`emptyInput`, `lockedMonth`, `coreAssembly`). Use `defaultState` when there is none.
- Expected result: a present-tense verb phrase (`returnsNoLines`, `throwsRangeError`, `importsNothingFromNode`).

Test files are named `{module}.test.ts`, and end-to-end files `{feature}.e2e.ts`. An architecture test enforces the three-level shape; review checks the wording.
