# Project standards: Folio

Project-specific rules for Folio. ai-foundation loads this file after the general standards it resolves from `.aiconfig.json` (`csharp_base`, `csharp_avalonia`). Where they disagree, this file wins. Why each rule exists is recorded in the architecture docs ([02_constraints.md](knowledge/architecture/02_constraints.md), [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md)); this file states the rules.

---

## Stack

These override the `csharp_avalonia` stack table.

| Layer        | Rule                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| UI framework | Avalonia 12.1.x, not 11.x. Do not move to 12.2 until FluentAvalonia supports it                                |
| Theme        | `FluentAvaloniaTheme` (FluentAvalonia 3.x), not `Avalonia.Themes.Fluent`. Load exactly one Fluent-family theme |
| MVVM         | CommunityToolkit.Mvvm. DynamicData only where a view filters a collection live                                 |
| Versions     | Exact pins in `Directory.Packages.props`; the SDK in `global.json`                                             |

## UI rules

- FluentAvalonia types and namespaces appear only under `src/Folio.Desktop/UI/Fluent/`. Screens use the app's wrappers (shell, dialog service, banner, icon). Enforced by `FluentIsolationTests`.
- Screens reference only WinUI token keys (`TextFillColor*`, `*FillColor*`, `*StrokeColor*`, `ControlCornerRadius`, `OverlayCornerRadius`) through `DynamicResource`. Never use FluentAvalonia-specific or `SystemControl*` keys, and never inline colours.
- Top-level commands use the in-window hamburger menu (PRD H1.14), not a docked `<Menu>` bar. This overrides the `csharp_avalonia` Windows menu rule. On macOS, the app also provides a `NativeMenu` with About, Settings, Quit and the standard Edit items (PRD H1.16).
- `ViewLocator` resolves views from an explicit registration table, not reflection, so it stays trim-safe.
- Keep view-models thin. If a view-model needs more than a trivial test, its logic belongs in `Folio.Core`.

## Naming

- Acronyms follow Microsoft's .NET guideline. Two-letter acronyms are all capitals (`UI`, `IO`); acronyms of three or more letters are PascalCase (`Cli`, `Csv`, `Json`, `Http`); abbreviations such as `Id` are PascalCase. Names from the framework or third-party libraries keep their own spelling.
- `private static readonly` fields are PascalCase, like constants (enforced by `.editorconfig`).
- The code name is `Folio` (namespaces `Folio.*`, CLI command `folio`). The file extension is `.folio`. The short name is `FOL`.

## Testing

These replace the test structure and naming in `csharp_base` and `csharp_avalonia`.

### Kinds

A test's kind is decided by the most expensive resource it touches, not by how much code it covers.

| Kind         | Rule                                                                                                                                                                                        | Project                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Unit         | One process, same result every run. No real file system, network or Avalonia platform; time comes from `TimeProvider`. Several real classes may work together if everything stays in memory | `tests/Unit/Folio.{Layer}.UnitTests`               |
| Integration  | One machine: real temporary folders on disk, Avalonia's headless platform, loopback HTTP                                                                                                    | `tests/Integration/Folio.{Layer}.IntegrationTests` |
| Architecture | Structural rules of the codebase itself (fitness functions)                                                                                                                                 | `tests/Architecture/Folio.ArchitectureTests`       |

- Property-based, snapshot and sample-file tests are techniques, not kinds. They go wherever their resources put them, usually Unit. Product rules such as "a locked month never changes" are ordinary unit or integration tests.
- Performance and end-to-end stress testing are a separate initiative, not kinds of this setup.
- Tagging tests across kinds is not used yet.

### Layout

- Each test project lives under `tests/<Kind>/` and its name ends in `<Kind>Tests`. It is listed in `tests/<Kind>.slnx` and in `Folio.slnx`. Enforced by `TestLayoutTests`.
- Each kind runs on its own with `dotnet test tests/<Kind>.slnx`; `dotnet test Folio.slnx` runs everything. CI runs architecture, then unit, then integration tests.
- Unit-test projects never reference Avalonia, FluentAvalonia or `Folio.Desktop`. Enforced by `UnitTestDependencyTests`. The no-file-system and no-network rule is checked in review.

### Naming

Test methods are named `{Subject}_{Condition}_{ExpectedResult}`:

- Subject: the member under test (`Parse`, `Show`). For architecture tests, the artefact being checked (`ReferencedAssemblies`, `SourceFiles`).
- Condition: the input, state or scope, as a noun phrase (`EmptyInput`, `ViewModelAsDataContext`, `CoreAssembly`). Use `DefaultState` when there is none.
- ExpectedResult: a present-tense verb phrase (`ReturnsEmptyResult`, `ThrowsArgumentException`, `ExcludeUIFrameworks`).

Test classes are named `{ClassUnderTest}Tests`, or `{Rule}Tests` for architecture tests. `TestNamingTests` enforces the three-part shape; review checks the wording.
