---
section: '02'
title: 'Architecture Constraints'
lifecycle: draft
tags: [constraints, stack, standards]
key_files:
  - global.json
  - Directory.Build.props
  - Directory.Packages.props
  - project-standards.md
---

> The fixed choices the architecture works within: platform, pinned stack, coding standards and product rules.

## Technical constraints

| Constraint   | Detail                                                                                                                                          | Source               |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Platform     | Desktop app on Windows, macOS and Linux                                                                                                         | PRD constraints      |
| UI           | Avalonia with the FluentAvalonia design system                                                                                                  | PRD constraints      |
| Runtime      | .NET 10 (LTS, supported to 2028-11-14). FluentAvalonia 3.x ships only for net10.0, and .NET 8 and 9 reach end of support on 2026-11-10          | Research, 2026-11-05 |
| Storage      | One local budget file opened like a document; may sit in a shared or synced folder                                                              | PRD constraints      |
| Data sources | CSV only; no bank connections                                                                                                                   | PRD constraints      |
| Network      | None by default; online lookups are opt-in and limited to services that neither keep nor sell data                                              | PRD H1.12            |
| Currency     | CAD only, exact cents, no floating point                                                                                                        | PRD assumption 2     |
| Concurrency  | One editor at a time; two simultaneous editors are not handled                                                                                  | PRD constraints      |
| Licences     | All dependencies MIT or equivalent; no paid Avalonia products (they add per-seat cost and a licence check that conflicts with the privacy goal) | Decision, 2026-11-05 |

## Pinned stack

Versions are exact and live in `Directory.Packages.props` (Central Package Management with transitive pinning). FluentAvalonia declares Avalonia ranges with no upper bound, so these pins are what keep the two compatible.

| Package                                                                                             | Version                                                              |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| .NET SDK                                                                                            | 10.0.1xx feature band (`global.json`, roll forward within the band)  |
| Avalonia, Avalonia.Desktop, Avalonia.Skia, Avalonia.Controls.ColorPicker, Avalonia.Headless(.XUnit) | 12.1.5                                                               |
| Avalonia.Controls.DataGrid                                                                          | 12.1.2 (deprecated upstream, bug fixes only)                         |
| FluentAvaloniaUI                                                                                    | 3.1.0                                                                |
| CommunityToolkit.Mvvm                                                                               | 8.4.2                                                                |
| xunit.v3                                                                                            | 3.2.2 (matches what Avalonia.Headless.XUnit 12.1.5 is built against) |

Do not move to Avalonia 12.2 until FluentAvalonia supports it and the Fluent2 theme question is settled ([11_risks.md](11_risks.md)).

## Organizational constraints: coding standards

The project follows the ai-foundation standards `csharp_base` and `csharp_avalonia` (`.aiconfig.json`). The build enforces what it can: nullable reference types, warnings as errors, explicit types instead of `var`, file-scoped namespaces, no primary constructors, explicit access modifiers, naming rules and XML docs on public members (`.editorconfig`, `Directory.Build.props`).

Folio's own rules, which refine or override those standards, are in [project-standards.md](../../project-standards.md), which ai-foundation loads last. That file covers the stack and theme, FluentAvalonia isolation, menus, acronym and field naming, and the test kinds, layout and naming. This section records only why the project departs from the shared standards.

Deviations from the shared ai-foundation standards. Each is in force through `project-standards.md` and is also proposed upstream:

| Standard says                                                     | This project                                                                                                                 | Status                                                                                                                       |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Avalonia 11.x                                                     | Avalonia 12.1.x                                                                                                              | Proposed upstream: Avalonia 12.x                                                                                             |
| `Avalonia.Themes.Fluent` as the base theme                        | `FluentAvaloniaTheme`                                                                                                        | Proposed upstream: the base standard stops naming a theme; a layered `csharp_avalonia_fluent` standard covers FluentAvalonia |
| Test projects named `{Project}.Tests` / `{Project}.Desktop.Tests` | One project per kind of test under `tests/<Kind>/`, named `*.UnitTests`, `*.IntegrationTests`, `*.ArchitectureTests` (AD-14) | Proposed upstream: the standards describe test kinds and separate runs                                                       |
| Acronym casing not specified; `CNS.Core.Services` example         | Microsoft's guideline: two-letter acronyms in capitals, longer ones PascalCase                                               | Proposed upstream as an explicit `csharp_base` rule                                                                          |
| Test naming `{MethodName}_{Scenario}_{ExpectedResult}`            | `{Subject}_{Condition}_{ExpectedResult}`, with architecture tests naming the artefact checked                                | Proposed upstream                                                                                                            |
| `<Menu>` bar docked at the top on Windows                         | Hamburger menu in the window (PRD H1.14), plus a `NativeMenu` on macOS                                                       | Proposed upstream: the rule defers to the product design and requires a macOS `NativeMenu`                                   |

## Product rules that act as constraints

- A locked month changes only through the guarded reopen (M1.7, M1.14, H1.8).
- Months close in order (M1.17).
- Closing, reopening and completing an import save immediately (H1.6b).
