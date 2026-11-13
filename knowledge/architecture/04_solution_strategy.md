---
section: '04'
title: 'Solution Strategy'
lifecycle: draft
tags: [strategy]
key_files: []
---

> The handful of ideas the rest of the design follows from. Each links to its decision in [09_architecture_decisions.md](09_architecture_decisions.md).

## The core ideas

1. _The file is a document, held in memory._ Opening a file loads everything into an immutable in-memory model. Edits change the model, and Save writes all of it atomically to a zip of JSON/JSONL parts (AD-1, AD-2). Discard drops the in-memory changes, autosave is a timed Save, and undo history survives saving. The file format stays a replaceable adapter.

2. _Every change is a command that produces a month-tagged change set._ One object per change carries before and after values, each tagged with the month it belongs to, or "global". The rest of the design reads these change sets. The single lock guard refuses any that touch a locked month (AD-4). Undo replays them backwards and, when a month closes, drops only that month's parts (AD-5). Dirty tracking, lookup indexes and the audit log read them too (AD-10).

3. _One classification entry point decides how every line counts, and its output is frozen at close._ The classifier asks the owning areas in a fixed order whether each transaction line is income, spending, savings, a neutral transfer, or excluded (AD-3, AD-6). Open months are classified live. Closing a month stores the results, and reports on locked months read the stored data, so those months cannot drift, even when the app's own code changes.

4. _The domain knows nothing about the UI or the host._ The `core` package holds the model, classifier, rules, matching, commands, undo and file format. It is plain TypeScript with no Node, DOM or Electron imports, so it runs unchanged in the desktop app, in plain Node tests, and in a browser (AD-14, AD-19). Tests enforce the boundary.

5. _The platform is one interface._ The renderer reaches the operating system only through a `HostApi` (dialogs, file reads and atomic writes, locks, backups, menus, drops). Electron implements it for the desktop, a mock implements it for tests, and a browser implementation can serve a read-only web build later. A server-backed store would be another `FileStore` behind the same door (AD-19).

6. _The running app is drivable by machine._ Playwright drives the exact release binary through a debugging pipe, and the same core runs in plain Node tests without a window, so agents and CI can test both without clicking pixels or opening a network port (AD-16).

7. _Privacy is checked, not assumed._ The renderer is sandboxed with no remote content, Electron's phone-home paths are switched off, and a CI capture verifies that nothing leaves the machine on every Electron update (AD-18).

## Solution structure

```
folio/
├── packages/
│   ├── core                   domain, classifier, rules, matching, commands, change sets, lock guard, undo, file format
│   ├── host-api               the HostApi and FileStore interfaces, plus an in-memory mock
│   └── renderer               React app: screens, chart models, app components
│       └── src/ui/fluent/     the only place Fluent UI types appear
├── apps/
│   ├── desktop                Electron main process, preload bridge, hardening, packaging
│   └── web                    (later) read-only browser host for the same renderer
└── tests/
    ├── integration/           real disk, a real browser engine for the renderer, loopback
    ├── architecture/          structural rules of the codebase
    └── e2e/                   Playwright against the packaged app
```

Unit tests sit next to the code they test as `*.test.ts`. The scaffold plan ([app-scaffold.md](../../plans/app-scaffold.md)) fixes the exact package names and tooling.

## Technology choices at a glance

| Concern       | Choice                                                                                               | Decision     |
| ------------- | ---------------------------------------------------------------------------------------------------- | ------------ |
| Stack         | Electron with React and TypeScript; Windows and macOS first; web later                               | AD-17        |
| File format   | Zip of JSON and JSONL parts with a manifest and checksums; fflate; schema validation at the boundary | AD-2         |
| Money         | Integer cents in a branded type, with checked arithmetic that throws instead of losing precision     | AD-7         |
| UI state      | A core store read through `useSyncExternalStore`; components stay thin                               | AD-14        |
| Design system | Fluent UI React v9, behind app components                                                            | AD-15        |
| Tables        | TanStack Virtual with Fluent table markup                                                            | AD-15        |
| Charts        | ECharts behind chart models                                                                          | AD-13        |
| Host boundary | `HostApi` and `FileStore`; Electron, mock and (later) browser implementations                        | AD-19        |
| Testing       | Vitest (unit, integration), fast-check, dependency-cruiser (architecture), Playwright (end-to-end)   | AD-14, AD-16 |
| Privacy       | Hardened renderer, fuses, deny-all requests, a CI network capture on every Electron update           | AD-18        |
| Packaging     | Windows installer and macOS disk image, unsigned for the household; no auto-update                   | AD-20        |
