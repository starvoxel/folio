# Folio

A desktop app a household opens once a month to import every account's transactions from CSV, check them, and see where the money went, how it compares to normal, and how net worth is moving. Closing a month locks its numbers so they stop moving.

Financial data stays in a budget file on your own computers. There are no bank logins and nothing leaves the file unless you opt in.

## Status

Architecture decided and the solution scaffolded; no features yet.

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

A test's kind is decided by the most expensive resource it touches, not by how much code it covers:

| Kind         | Rule                                                                                                                                                                                                                                               | Examples                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Unit         | Runs in one process and gives the same result every time. No real file system, network or Avalonia platform; time comes from a controllable clock (`TimeProvider`). Several real classes may work together, as long as everything stays in memory. | Domain rules, the classifier, a `.folio` round trip through a `MemoryStream`                                                      |
| Integration  | Stays on one machine: a real temporary folder on disk, Avalonia's headless platform, loopback HTTP.                                                                                                                                                | Views and bindings, saving to disk, the automation server, the few view-models with logic of their own                            |
| Architecture | Structural rules of the codebase itself (fitness functions).                                                                                                                                                                                       | Core never references the UI, FluentAvalonia only under `UI/Fluent/`, unit tests never reference Avalonia, test layout and naming |

- Property-based, snapshot and sample-file tests are techniques, not kinds: they go wherever their resources put them, usually Unit. Product rules such as "a locked month never changes" are ordinary unit or integration tests.
- View-models stay thin. When one needs more than a trivial test, its logic belongs in Core and is unit tested there.
- Each kind lives under `tests/<Kind>/`, its project names end in `<Kind>Tests`, and it is listed in `tests/<Kind>.slnx` and `Folio.slnx`. Architecture tests enforce this, and that unit-test projects never reference Avalonia; the rest of the unit rule is checked in review.
- CI runs architecture tests first because they are the cheapest.
- Tagging tests across kinds (for example slow or visual tests) may come later; it is not set up.
- Performance and end-to-end stress testing are a separate initiative; how and where they run is still to be investigated.

Test methods are named `{Subject}_{Condition}_{ExpectedResult}`, for example `Parse_EmptyInput_ReturnsEmptyResult`; the rules are in `TestNamingTests`, which also enforces the three-part shape.

## Documentation

| Where                                                                          | What                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [knowledge/product/month-end-review.md](knowledge/product/month-end-review.md) | Product requirements overview, with one linked doc per feature area                                                           |
| [knowledge/architecture/](knowledge/architecture/)                             | arc42 architecture docs; decisions are in [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md) |
| `plans/`                                                                       | Approved implementation plans (none yet)                                                                                      |
