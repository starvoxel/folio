---
section: '04'
title: 'Solution Strategy'
lifecycle: draft
tags: [strategy]
key_files:
  - Folio.slnx
---

> The handful of ideas the rest of the design follows from. Each links to its decision in [09_architecture_decisions.md](09_architecture_decisions.md).

## The core ideas

1. _The file is a document, held in memory._ Opening a file loads everything into an immutable in-memory model. Edits change the model, and Save writes all of it atomically to a zip of JSON/JSONL parts (AD-1, AD-2). Discard drops the in-memory changes, autosave is a timed Save, and undo history survives saving. The file format stays a replaceable adapter.

2. _Every change is a command that produces a month-tagged change set._ One object per change carries before and after values, each tagged with the month it belongs to, or "global". The rest of the design reads these change sets. The single lock guard refuses any that touch a locked month (AD-4). Undo replays them backwards and, when a month closes, drops only that month's parts (AD-5). Dirty tracking, lookup indexes and the audit log read them too (AD-10).

3. _One classification entry point decides how every line counts, and its output is frozen at close._ The classifier asks the owning areas in a fixed order whether each transaction line is income, spending, savings, a neutral transfer, or excluded (AD-3, AD-6). Open months are classified live. Closing a month stores the results, and reports on locked months read the stored data, so those months cannot drift, even when the app's own code changes.

4. _The domain knows nothing about the UI._ `Folio.Core` holds the model, classifier, rules, matching, commands, undo and file format, and is tested without a UI. `Folio.Desktop` is thin MVVM over it (AD-14). Tests enforce the boundary.

5. _The UI stack is isolated._ FluentAvalonia is used only under `UI/Fluent/`, screens use WinUI token keys only, and charts are custom-drawn behind view-models (AD-13, AD-15). This contains the risk of single-maintainer and deprecated dependencies.

6. _The running app is drivable by machine._ An opt-in loopback automation server exposes the same commands, queries and view-model actions the UI uses, with a `folio` CLI and a headless mode for CI and agents (AD-16).

## Solution structure

```
Folio.slnx
├── src/
│   ├── Folio.Core             domain, classifier, rules, matching, commands, change sets, lock guard, undo, file format
│   ├── Folio.Desktop          Avalonia + FluentAvalonia views and view-models; thin platform adapters
│   │   └── UI/Fluent/         the only place FluentAvalonia types appear
│   ├── Folio.Automation       (planned) loopback HTTP server exposing commands, queries and UI actions
│   └── Folio.Cli              (planned) `folio` command-line client
└── tests/                     one folder and one solution file per kind of test (AD-14)
    ├── Unit/                  Folio.Core.UnitTests: in-memory, one process; the bulk of the tests
    ├── Integration/           Folio.Desktop.IntegrationTests: real disk, headless app, loopback
    └── Architecture/          Folio.ArchitectureTests: structural rules of the codebase
```

## Technology choices at a glance

| Concern                  | Choice                                                                                                                                          | Decision     |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| File format              | Zip of JSON and JSONL parts with a manifest and checksums, System.Text.Json source generation                                                   | AD-2         |
| Money                    | `Money` value type over `long` cents with checked arithmetic                                                                                    | AD-7         |
| MVVM                     | CommunityToolkit.Mvvm; DynamicData only for live-filtered collections                                                                           | AD-14        |
| Theme and shell controls | FluentAvalonia 3.1, isolated behind app wrappers                                                                                                | AD-15        |
| Tables                   | DataGrid where sorting or editing is needed; TableView for small read-only tables                                                               | AD-15, risks |
| Charts                   | Custom-drawn controls behind chart view-models                                                                                                  | AD-13        |
| Testing                  | xUnit v3 in three separately runnable kinds (unit, integration, architecture); Avalonia.Headless.XUnit; the automation CLI for end-to-end later | AD-14, AD-16 |
