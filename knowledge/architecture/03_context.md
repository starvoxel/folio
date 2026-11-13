---
section: '03'
title: 'Context and Scope'
lifecycle: draft
tags: [context]
key_files: []
---

> What the app talks to: the people using it, the files it reads and writes, and test tooling. Nothing else in v1.

## Business context

```
                        ┌──────────────────────────────┐
  Household member ────▶│                              │──▶ Budget file (.folio, zip of JSON/JSONL)
  (desktop UI)          │             Folio            │◀── (local disk or a synced folder)
                        │                              │
  Bank CSV exports ────▶│                              │──▶ Backups (local app-data folder)
  (read only)           │                              │
                        │                              │◀─▶ Machine preferences (local app-data)
  Test tooling ────────▶│  no network port             │
  (automated tests)    └──────────────────────────────┘
                                      ┊
                                      ┊ opt-in only, not in v1
                                      ▼
            Online merchant lookup (research first)
            Household-hosted server for the data, instead of a local file (later)
```

| Partner                              | Direction  | What crosses                                                                                                                                                                 |
| ------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Household member                     | In and out | Every interaction, through the desktop UI                                                                                                                                    |
| Bank CSV exports                     | In         | Files picked or dropped by the user; read locally, never uploaded                                                                                                            |
| Budget file                          | In and out | The household's entire data set; written atomically on save                                                                                                                  |
| Backups                              | Out        | Copies of the budget file, rotated (AD-12)                                                                                                                                   |
| Machine preferences                  | In and out | Theme, autosave interval, auto-open, recent files, backup location (AD-11)                                                                                                   |
| Test tooling and agents              | In and out | Playwright drives the app through a debugging pipe owned by the test process, only when the app is started for testing (AD-16)                                               |
| Online merchant lookup               | Out        | Not in v1. If ever added it is opt-in, stored per budget file, and limited to services that neither keep nor sell data                                                       |
| Household-hosted server for the data | In and out | Not in v1. If ever added it is a `FileStore` implementation (AD-19), opt-in and controlled by the household, and the content security policy then allows exactly that origin |

## Technical context

- The app opens no network listener and has no automation port. Test tooling attaches through Chromium's debugging pipe, which only the process that launched the app holds (AD-16).
- The app makes no outbound network calls in normal operation. The renderer's content security policy forbids them, a deny-all request filter backs that up, and a CI capture checks the built app (AD-18).
- Chromium itself performs a reachability check (a UDP `connect()` to a public DNS address) before resolving any host name. It sends no packet, cannot be switched off, and appears in captures as a known notice (AD-18).
- A sidecar `.lock` file next to the budget file warns when another computer has it open (AD-12).
- A web build, when it comes, reads a `.folio` file the user picks in the browser and parses it locally, with no upload (AD-19).
