---
section: '03'
title: 'Context and Scope'
lifecycle: draft
tags: [context]
key_files: []
---

> What the app talks to: the people using it, the files it reads and writes, and the local automation client. Nothing else.

## Business context

```
                        ┌──────────────────────────────┐
  Household member ────▶│                              │──▶ Budget file (.folio, zip of JSON/JSONL)
  (desktop UI)          │             Folio            │◀── (local disk or a synced folder)
                        │                              │
  Bank CSV exports ────▶│                              │──▶ Backups (local app-data folder)
  (read only)           │                              │
                        │                              │◀─▶ Machine preferences (local app-data)
  folio CLI ───────────▶│  loopback only, opt-in       │
  (AD-16)               └──────────────────────────────┘
                                      ┊
                                      ┊ opt-in only, not in v1
                                      ▼
                           Online merchant lookup (research first)
```

| Partner                | Direction  | What crosses                                                                                                                       |
| ---------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Household member       | In and out | Every interaction, through the desktop UI                                                                                          |
| Bank CSV exports       | In         | Files picked or dropped by the user; read locally, never uploaded                                                                  |
| Budget file            | In and out | The household's entire data set; written atomically on save                                                                        |
| Backups                | Out        | Copies of the budget file, rotated (AD-12)                                                                                         |
| Machine preferences    | In and out | Theme, autosave interval, auto-open, recent files, backup location (AD-11)                                                         |
| `folio` CLI and agents | In and out | Commands, queries, UI state and screenshots over HTTP on `127.0.0.1`, only when the app is started with automation enabled (AD-16) |
| Online merchant lookup | Out        | Not in v1. If ever added it is opt-in, stored per budget file, and limited to services that neither keep nor sell data             |

## Technical context

- No network listener exists unless the app is started with `--automation`; when it is, it binds to loopback only and requires a per-session token.
- No outbound network calls in normal operation. Dependencies are checked for this (paid Avalonia components are excluded partly because they contain licence-validation code).
- A sidecar `.lock` file next to the budget file warns when another computer has it open (AD-12).
