# Folio

A desktop app a household opens once a month to import every account's transactions from CSV, check them, and see where the money went, how it compares to normal, and how net worth is moving. Closing a month locks its numbers so they stop moving.

Financial data stays in a budget file on your own computers. There are no bank logins and nothing leaves the file unless you opt in.

## Status

The product requirements and architecture are decided. There is no application code yet: the repository still holds a placeholder .NET scaffold from before the stack was chosen, and the first task of the [app scaffold plan](plans/app-scaffold.md) replaces it with the TypeScript workspace. The build and test commands below arrive with that scaffold.

## Stack

Electron with React and TypeScript, Fluent UI React v9 for components, TanStack Virtual for large tables and ECharts for charts. The domain core is plain TypeScript with no Node, DOM or Electron imports, so the same code can later serve a read-only web build. Tests use Vitest, fast-check, dependency-cruiser and Playwright. Windows and macOS are the v1 platforms. The reasoning is in [AD-17](knowledge/architecture/09_architecture_decisions.md#ad-17-electron-with-typescript-is-the-stack) and the research behind it in [knowledge/research/](knowledge/research/). Coding standards come from ai-foundation, configured in [.aiconfig.json](.aiconfig.json); [project-standards.md](project-standards.md) holds only Folio's test conventions.

## Build and test

Commands come with the scaffold. The planned shape is one command per kind of test and a single command that runs them all.

### Kinds of test

There are four kinds of test, decided by the most expensive resource a test touches. Each runs on its own:

- _Unit tests_ run in memory, in one process, with no real file system, network, Electron or browser engine.
- _Integration tests_ stay on one machine and may use real temporary folders, the real host adapter and a real browser engine for the renderer.
- _Architecture tests_ check structural rules of the codebase itself, such as package boundaries.
- _End-to-end tests_ drive the packaged app in a real window with Playwright.

The full rules for test kinds, layout and naming are in [project-standards.md](project-standards.md). Performance and stress testing are a separate initiative.

## Documentation

| Where                                                                          | What                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [knowledge/product/month-end-review.md](knowledge/product/month-end-review.md) | Product requirements overview, with one linked doc per feature area                                                           |
| [project-standards.md](project-standards.md)                                   | Folio-specific conventions (the kinds of test) on top of the ai-foundation standards                                          |
| [knowledge/architecture/](knowledge/architecture/)                             | arc42 architecture docs; decisions are in [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md) |
| [knowledge/research/](knowledge/research/)                                     | Research briefs, including the stack comparison                                                                               |
| [plans/](plans/)                                                               | Implementation plans                                                                                                          |
