# Research note: generating the ViewLocator table at build time

- _Date:_ 2026-11-05
- _Requested by:_ Jeremy, in review of the scaffold PR (#10, thread on `ViewLocator.cs`)
- _Status:_ Exploration only. There is no architecture decision, plan or implementation. Revisit when the shell spike adds the first real views.
- _Question:_ Once Folio has more than a handful of views, should a build-time source generator fill in the `ViewLocator` registration table? If so, how should views and view-models be paired?

Evidence labels: _verified_ means checked in this repository; _background_ means common .NET or Avalonia practice I did not re-check this session; _UNVERIFIED_ means it needs confirming before anyone relies on it.

---

## 1. Where things stand

- `src/Folio.Desktop/ViewLocator.cs` maps each view-model type to a factory for its view in an explicit `Dictionary<Type, Func<Control>>`. It uses no reflection, so it stays safe under trimming (verified).
- The `csharp_avalonia` standard requires 1:1 pairs named `{Feature}View` and `{Feature}ViewModel`, resolved through a `ViewLocator` (verified in ai-foundation).
- Avalonia's template `ViewLocator` instead finds the view by reflection on the name (`ViewModel` → `View`, then `Type.GetType`). The template itself notes this is not trimming-friendly (background).
- Today there is one window, so the table is empty. The shell spike (milestone 1) will add the first pages: Overview, Transactions, Reporting, Net worth, Accounts, Rules & categories and Settings, plus dialogs.

## 2. What a generator would do

An `IIncrementalGenerator` runs at compile time over `Folio.Desktop` and emits the registration table as a partial class. `ViewLocator` keeps its lookup code and loses the hand-edited list.

Pairing options:

| Option                             | How it pairs                                          | Strengths                                                 | Weaknesses                                                      |
| ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- |
| Naming convention only             | `FooView` ↔ `FooViewModel` in the matching namespace | Nothing to add to each type; follows the standard already | Fails silently for names that cannot match; renames break pairs |
| Attribute on the view              | `[ViewFor<FooViewModel>]` on the view class           | Explicit, survives renames, one source of truth           | One attribute per view                                          |
| Attribute on both                  | Each side names the other                             | Discoverable from either side                             | Two places to keep in sync                                      |
| Convention plus optional attribute | Convention by default; the attribute overrides        | Little ceremony with an escape hatch                      | Two rules to learn                                              |

My current lean is convention plus an optional attribute on the view (inference).

The generator can also report problems as compile errors (diagnostics):

- a view-model with no view
- a view claimed by two view-models
- an attribute that names a type which is not a view-model
- a view without a public parameterless constructor

That turns mistakes the hand-written table only reveals at run time ("No view registered for …") into build failures.

## 3. Costs and risks

- _Size:_ a small `Folio.Generators` project targeting netstandard2.0, as Roslyn generators require (background), plus unit tests that run the generator on sample source. Estimated at about a day (inference).
- _Tooling:_ generator projects need an analyzer-style project reference (`OutputItemType="Analyzer"`, `ReferenceOutputAssembly="false"`). IDE support for debugging and refresh is uneven (background).
- _Test kinds:_ generator tests run in memory, so they are unit tests (`tests/Unit/Folio.Generators.UnitTests`). The layout rules already allow that.
- _Interaction with Avalonia's own generators:_ Avalonia's XAML compiler also generates code for views (`InitializeComponent`). A generator that inspects view classes must not depend on that generated code (_UNVERIFIED_: check the order generators run in and what one can see of another's output).
- _Existing packages:_ community source generators for Avalonia view locators may exist. If one is mature, MIT-licensed and works with Avalonia 12, it could replace writing our own (_UNVERIFIED_: not searched).

## 4. Alternatives to a generator

- _Keep the hand-written table and add an architecture test_ that fails when a `*ViewModel` in `Folio.Desktop` has no registration. It is cheap and catches the main mistake, but the table is still edited by hand.
- _Avalonia's reflection-based template locator._ Rejected because it is not trim-safe and hides mistakes until run time.
- _DataTemplates in XAML_ (`<DataTemplate DataType="vm:FooViewModel"><v:FooView/></DataTemplate>`). Built into Avalonia and trim-safe with compiled bindings, but it is another hand-maintained list in XAML (background).

## 5. When to revisit

- When the shell spike lands and the page count passes about five, compare the hand-written table against the generator.
- Meanwhile, the interim architecture test from section 4 is the low-cost safety net, if wanted.

## 6. Open questions for Jeremy

1. Pairing: convention only, an attribute only, or convention plus an optional attribute?
2. Build our own generator, or first look for an existing package?
3. Add the interim "every view-model is registered" architecture test with the shell spike?

## Sources

- `src/Folio.Desktop/ViewLocator.cs` (this repository)
- ai-foundation `standards/csharp_avalonia.md`, ViewModel / View Pairing section
- Review thread on #10: https://github.com/starvoxel/month-end-finance-reviewer/pull/10#discussion_r4481089898
