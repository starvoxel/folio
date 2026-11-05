# Month-End Finance Reviewer

A desktop app a household opens once a month to import every account's transactions from CSV, check them, and see where the money went, how it compares to normal, and how net worth is moving. Closing a month locks its numbers so they stop moving.

Financial data stays in a budget file on your own computers. There are no bank logins and nothing leaves the file unless you opt in.

## Status

Architecture decided and the solution scaffolded; no features yet. The next step is the stack spike in [plans/](plans/).

## Stack

C# desktop app on .NET 10 with Avalonia 12.1 and the FluentAvalonia design system (Windows, macOS, Linux), MVVM with CommunityToolkit.Mvvm, tests with xUnit v3 and Avalonia headless. Exact versions are pinned in [Directory.Packages.props](Directory.Packages.props). Coding standards are `csharp_base` and `csharp_avalonia`, configured in [.aiconfig.json](.aiconfig.json).

## Build and test

Needs the .NET 10 SDK (see [global.json](global.json)).

```
dotnet build Mefr.slnx
dotnet test Mefr.slnx
dotnet run --project src/Mefr.Desktop
dotnet format Mefr.slnx --verify-no-changes
```

| Project                    | Holds                                                                                     |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| `src/Mefr.Core`            | All domain logic; never references the UI                                                 |
| `src/Mefr.Desktop`         | Avalonia views, view-models and platform adapters; FluentAvalonia only under `Ui/Fluent/` |
| `tests/Mefr.Core.Tests`    | Domain and architecture tests                                                             |
| `tests/Mefr.Desktop.Tests` | View-model and headless UI tests                                                          |

## Documentation

| Where                                                                          | What                                                                                                                          |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| [knowledge/product/month-end-review.md](knowledge/product/month-end-review.md) | Product requirements overview, with one linked doc per feature area                                                           |
| [knowledge/architecture/](knowledge/architecture/)                             | arc42 architecture docs; decisions are in [09_architecture_decisions.md](knowledge/architecture/09_architecture_decisions.md) |
| [plans/](plans/)                                                               | Implementation plans                                                                                                          |
