# Folio

A desktop app a household opens once a month to import every account's transactions from CSV, check them, and see where the money went, how it compares to normal, and how net worth is moving. Closing a month locks its numbers so they stop moving.

Financial data stays in a budget file on your own computers. There are no bank logins and nothing leaves the file unless you opt in.

## Status

The solution is scaffolded; no features yet.

## Stack

C# desktop app on .NET 10 with Avalonia 12.1 and the FluentAvalonia design system (Windows, macOS, Linux), MVVM with CommunityToolkit.Mvvm, tests with xUnit v3 and Avalonia headless. Exact versions are pinned in [Directory.Packages.props](Directory.Packages.props). Coding standards are `csharp_base` and `csharp_avalonia`, configured in [.aiconfig.json](.aiconfig.json).

## Build and test

Needs the .NET 10 SDK (see [global.json](global.json)).

```
dotnet build Folio.slnx
dotnet test Folio.slnx                       # every test
dotnet test tests/Unit.slnx                  # unit tests only
dotnet test tests/Integration.slnx           # integration tests only
dotnet test tests/Architecture.slnx          # architecture tests only
dotnet run --project src/Folio.Desktop
dotnet format Folio.slnx --verify-no-changes
```

| Project                                            | Holds                                                                                     |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/Folio.Core`                                   | All domain logic; never references the UI                                                 |
| `src/Folio.Desktop`                                | Avalonia views, view-models and platform adapters; FluentAvalonia only under `UI/Fluent/` |
| `tests/Unit/Folio.Core.UnitTests`                  | Unit tests                                                                                |
| `tests/Integration/Folio.Desktop.IntegrationTests` | Integration tests                                                                         |
| `tests/Architecture/Folio.ArchitectureTests`       | Architecture tests                                                                        |

### Kinds of test

There are three kinds of test, decided by the most expensive resource a test touches. Each runs on its own:

- **Unit**: in memory, one process; no real file system, network or Avalonia platform.
- **Integration**: one machine; real temporary folders, Avalonia's headless platform, loopback HTTP.
- **Architecture**: structural rules of the codebase itself.

The full rules for test kinds, layout and naming are in [project-standards.md](project-standards.md). Performance and end-to-end stress testing are a separate initiative.

## Documentation

| Where                                                                          | What                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| [knowledge/product/month-end-review.md](knowledge/product/month-end-review.md) | Product requirements overview, with one linked doc per feature area                           |
| [project-standards.md](project-standards.md)                                   | Folio's implementation conventions on top of the ai-foundation standards (currently: testing) |
| `knowledge/architecture/`                                                      | arc42 architecture docs (none yet)                                                            |
| `plans/`                                                                       | Approved implementation plans (none yet)                                                      |
