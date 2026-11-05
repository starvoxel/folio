# Project standards: Folio

Folio's implementation conventions. ai-foundation loads this file after the general standards it resolves from `.aiconfig.json` (`csharp_base`, `csharp_avalonia`), and where they disagree this file wins.

Rules that have another owner are not repeated here: the stack and pinned versions (`Directory.Packages.props`, [02_constraints.md](knowledge/architecture/02_constraints.md)), architecture decisions such as FluentAvalonia isolation (each enforced by its own architecture test, [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md)), product requirements such as menus (`knowledge/product/`), and generic C# naming rules (the ai-foundation standards).

---

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
