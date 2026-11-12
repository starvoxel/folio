# Proposal: TypeScript, React and Electron standards for ai-foundation

- _Date:_ 2026-11-12
- _Requested by:_ Jeremy, so ai-foundation can add TypeScript standards
- _Status:_ A proposal to discuss, not adopted anywhere. Until ai-foundation has these, Folio keeps the language-level rules in [project-standards.md](../../project-standards.md), which wins over the standards `.aiconfig.json` loads.
- _Basis:_ the existing `javascript_base` (1.0.3) and `javascript_node` (1.0.4) standards in ai-foundation, which already name `typescript_base` as a future layer and `typescript_node` in the naming convention, and Folio's stack decision (AD-17).

## How it fits the existing layers

ai-foundation matches a standard when all of its tags are in the project's tag list, and loads `depends_on` first. The existing files give the pattern: `javascript_base` (tags `[javascript]`) holds runtime-agnostic language rules and `javascript_node` (tags `[javascript, node]`, depends on `javascript_base`) adds Node. TypeScript fits the same shape:

| Proposed standard     | Tags                     | Depends on                            | Covers                                                                                 |
| --------------------- | ------------------------ | ------------------------------------- | -------------------------------------------------------------------------------------- |
| `typescript_base`     | `[typescript]`           | `javascript_base`                     | The type system, project configuration, error and result style, TSDoc, branded types   |
| `typescript_node`     | `[typescript, node]`     | `typescript_base`, `javascript_node`  | Node-side TypeScript: module resolution, extensions, test framework choice, CLI layout |
| `typescript_react`    | `[typescript, react]`    | `typescript_base`                     | Components, hooks, state, accessibility, testing with a simulated DOM, test IDs        |
| `typescript_electron` | `[typescript, electron]` | `typescript_node`, `typescript_react` | Process model, security baseline, IPC, fuses, packaging, privacy checks, E2E driving   |

A project then lists tags such as `["typescript", "node", "react", "electron"]`. Folio would use all four. A design-system layer (for example `typescript_react_fluentui`, tags `[typescript, react, fluentui]`) would follow the same pattern as `csharp_avalonia_fluentavalonia`: it holds only rules that apply when that library is used.

## What stays from `javascript_base` and `javascript_node`

Style basis (Airbnb), 2-space indent, single quotes, semicolons, trailing commas, about 100 characters, `const` over `let`, `===`, named exports, arrow functions for callbacks, `function` declarations for exported top-level functions, `async`/`await`, `throw` only `Error` subclasses with `cause`, no `eval`, untrusted `JSON.parse`, the file header block, the `node:` prefix, path handling with `node:path`, structured logging for long-running services, and the security checklist items. The TypeScript layers add to these and override only the points below.

## Proposed `typescript_base`

_Overrides_ of `javascript_base`: the "Type system: plain JavaScript" row is replaced by TypeScript; mandatory JSDoc types become TSDoc without repeated types; the file header block applies to `.ts` and `.tsx`.

- _Compiler options._ `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, and `isolatedModules` where a bundler is used. Compile with warnings as errors. Open: which TypeScript version floor to name.
- _Types._ No `any`; use `unknown` at boundaries and narrow with a schema. Avoid assertions; justify any that remain. Prefer string-literal unions and discriminated unions to `enum`. Prefer `readonly` and immutable updates. Use `satisfies` to check literals without widening.
- _Explicitness._ Explicit return types on exported functions and public class members; inference for locals. This is the TypeScript counterpart of the C# standard's "explicit types, no `var`" and keeps agent-written code reviewable.
- _Branded types._ Quantities with rules (money, dates, ids) are branded types created only through validating constructors.
- _Errors._ Exceptions for bugs and unrecoverable states; a discriminated `Result` for expected failures. Custom `Error` subclasses carry a `code`. Open: whether to name a small result library or require a project-local type.
- _Boundaries._ Everything crossing a trust boundary (files, IPC, network, `JSON.parse`) is validated by a schema (a runtime schema library such as zod) and typed from it.
- _Documentation._ TSDoc on exported members, with `@throws` where a function intentionally throws.
- _Linting and formatting._ ESLint with `typescript-eslint` in its strict, type-checked configuration, warnings as errors; a formatter check (Prettier or Biome, an open choice) matching the shared formatting table; a rule banning floating-point arithmetic for money where a project defines one.
- _Dependencies._ Pin exact versions and commit the lockfile. Block dependency install scripts unless allowlisted, set a minimum release age for new versions, install from the lockfile in CI, check licences against the project's allowed list.
- _Testing._ Vitest is the default framework (an allowed override of `node:test` under `javascript_node`); property-based tests with fast-check for invariants; test names state subject, condition and expected result.

## Proposed `typescript_node`

- ESM with `NodeNext` resolution, so relative imports end in `.js` as `javascript_node` already requires; the `node:` prefix; strict TypeScript for CLIs and tools; a thin `bin/` entry point delegating to testable functions.
- Keep pure logic separate from I/O, as `javascript_node` says, and pass dependencies (clock, file system) in so tests need no mocks of globals.

## Proposed `typescript_react`

- Function components and hooks only; no class components. Components stay thin, and logic with more than a trivial test lives in a pure module.
- State comes from a store read with `useSyncExternalStore`, or from local state for purely visual concerns. Effects are a last resort and never hold business rules.
- Accessibility by default: roles and names for every interactive control, keyboard operation for everything a mouse can do, visible focus, and a stable `data-testid` on controls test tools must find.
- Colours, spacing and type come from design tokens, never literals.
- Component tests use a simulated DOM and run as unit tests; anything needing a real browser engine is an integration test.
- Imports from a design-system package are confined to one folder behind app components, enforced by a dependency-boundary check.

## Proposed `typescript_electron`

- _Process model._ Context isolation on, Node integration off, sandbox on. A preload bridge exposes the smallest possible API and validates every message with a schema; handlers treat input as untrusted.
- _Content._ No remote content; a strict content security policy; the UI served from a custom protocol; deny-all permission handlers; navigation, new windows and `<webview>` blocked.
- _Privacy._ No crash reporter, no updater by default, proxy discovery off, spellcheck dictionary download prevented by emptying the language list, no Google API key variables, and a network capture in CI on every Electron update that fails on any non-loopback connection or external DNS lookup beyond the documented Chromium notice. Open: whether the capture job belongs in the standard or in a separate procedure.
- _Fuses._ Run-as-Node, Node options and Node CLI inspect arguments off in release; load-app-only-from-asar and ASAR integrity on; file-protocol privileges off.
- _Testing the app._ Drive the packaged release binary with Playwright through Chromium's debugging pipe, with a main-process guard that refuses debugging unless an explicit environment variable is set; screenshot baselines are kept per operating system.
- _Packaging._ Name the packager and installer tooling per project. A Linux `.deb` carries the AppArmor profile and is launched in CI without `--no-sandbox`; AppImage is secondary. Signing and update policy are project decisions.
- _Platform boundary._ The renderer reaches the OS only through a host interface, so the same renderer can run in a browser or another shell.

## Open questions

1. Formatter and linter: Prettier plus ESLint, or Biome? Folio has not chosen.
2. Package manager: npm workspaces, or pnpm with the hoisted linker (it conflicts with Electron packaging tools otherwise)? Folio's scaffold plan decides; the standard could name a default or stay neutral.
3. Result style: a project-local `Result` type, a named library, or exceptions only?
4. Should the privacy-capture job be part of `typescript_electron` or a separate steering procedure?
5. Should the design-system layer for Fluent UI React exist now, or only when a second project needs it?
