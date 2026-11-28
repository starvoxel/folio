---
section: '09.02'
title: 'The file, backups and the host interface'
lifecycle: draft
tags: [decisions, file, host]
key_files:
  - packages/core/src/file/codec.ts
  - packages/core/src/file/parts.ts
  - packages/core/src/file/zip-bytes.ts
  - packages/host-api/src/host-api.ts
  - apps/desktop/src/main/file-host.ts
  - apps/desktop/src/main/atomic-write.ts
  - apps/desktop/src/main/lock-file.ts
  - apps/desktop/src/main/backups.ts
  - apps/desktop/src/main/file-event-log.ts
  - packages/renderer/src/session/file-session.ts
  - apps/desktop/src/main/backup-store.ts
  - apps/desktop/src/main/serial-queue.ts
  - apps/desktop/src/main/menu-template.ts
  - apps/desktop/src/main/menu-automation.ts
  - apps/desktop/src/main/dropped-files.ts
  - apps/desktop/src/preload/file-drops.ts
---

> Decisions AD-2, AD-11, AD-12, AD-19. The list of all decisions is in [09_architecture_decisions.md](09_architecture_decisions.md).

## AD-2. The budget file is a zip of JSON and JSONL parts

_Context._ With AD-1, a database's strengths (querying while working, incremental writes, many writers) go unused. What matters is atomic saves, corruption detection, schema evolution, later encryption and attachments, and a format the household can inspect.

_Decision._ A budget file uses the `.folio` extension and is a zip container, like `.docx`:

- `manifest.json`: file-format version, app version, a checksum per part, and whether each part is JSON or JSONL.
- One part per area (accounts, transactions, rules, months, net worth, settings, audit log). Parts that are long lists of independent records, such as transactions and the audit log, may be JSONL (one record per line). JSONL allows streaming and readable diffs, and a damaged line loses one record, not the whole part. Small structured parts stay JSON.
- `summary.json`: what the start screen shows (H1.1) without loading the rest.

Save writes a complete new file beside the original, flushes it, then atomically replaces the original. Save goes through the host (AD-19), which owns file-system access. Format upgrades are one migration step per format version on the way in. Parts are read and written with `JSON.parse` and `JSON.stringify` (JSONL line by line) and zipped with fflate. Every part is validated against a schema (for example with zod) on the way in, because parsed JSON is untrusted input.

_Version 1 (in `packages/core/src/file/`)._ The container is pure bytes in, bytes out; `encodeFolio` and `decodeFolio` do no file I/O and return typed failures, never throw on input.

- _Parts._ One registry (`parts.ts`) lists `settings`, `accounts`, `categories` (JSON), `transactions` (JSONL), `rules`, `months`, `networth` (JSON) and `audit` (JSONL), plus the derived `summary.json`. Encode, decode and the manifest walk it. A part whose plan has not landed is _carried_: validated as any list or object, kept unread and written back as it was, so a file saved by this version loses nothing a later one wrote.
- _Checksums._ SHA-256 per part, in the manifest, through an injected `Digest`. `core` has no `crypto` typings and must stay free of Node and the DOM, so the host passes `crypto.subtle` and tests pass the same call. A mismatch refuses the whole file (`checksumMismatch`, naming the part), which is the corruption check and the trigger for the backup offer (H1.11).
- _Damaged lines._ In a file whose checksums match, a JSONL line that does not parse or fit its schema is dropped and reported by line number; the rest opens.
- _Determinism._ Entries are written in registry order, JSON keys are sorted, and every zip timestamp is overwritten with 1980-01-01, because fflate writes local time. The same model gives the same bytes on every machine.
- _Failures._ `notAZip` (also for a zip that claims more than 64 MiB for an entry, 256 MiB in all, or more than 64 entries, checked before anything is inflated), `manifestMissing`, `manifestInvalid`, `newerFormat`, `partMissing`, `checksumMismatch`, `schemaInvalid` (part and path, no value) and `migrationFailed`. The migration chain is empty while version 1 is a draft.

Filtering stays in memory: array methods over the model plus a few lookup indexes (by month, by account) that change sets keep up to date. An in-memory database was rejected because it would be a second copy of the data to keep in sync with every command, undo and redo.

_Consequences._ There is no native dependency. Encryption, when it comes, is AES-GCM over the file's bytes, and attachments (PDF import) become zip entries. We write migration code by hand, and the file cannot be queried ad hoc outside the app.

## AD-11. Settings split between file and machine

_Decision._

| Stored in the budget file (household)                                                                                                                       | Stored on the machine (person)                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Provider profiles, transfer matching window, rolling average length, coverage tolerance, review and suspicious-transaction thresholds, online-lookup opt-in | Theme, autosave interval, auto-open last file, recent files, backup location |

The online-lookup opt-in lives in the file because it decides whether household data leaves the computer.

## AD-12. Backups, lock file and on-disk change check

_Decision._ Back up the file on open and on a rotating schedule, to the local app-data folder rather than beside the file, so a synced folder does not fill with copies (H1.10). A sidecar `.lock` file warns when another computer has the file open. Before saving, check whether the file changed on disk since it was loaded and warn instead of overwriting. Frequency and retention are set in the backup plan.

_Built (Electron foundations milestone 2)._ The main process implements these behind `HostApi` and `FileStore`, and the mock follows the same rules.

- _Save._ `writeAtomically` writes a temporary file beside the target, flushes it, renames it over the target, and flushes the folder where the operating system allows (not on Windows). When the caller passes the stamp it last saw (modification time in whole milliseconds and size) and the file differs, nothing is written and the result is `changedOnDisk`; a file deleted since it was read rejects with `notFound` instead of being recreated. A crash leaves the old file or the new one; a crash can leave a leftover `.name.id.tmp` file, which later saves ignore (so does a `.lock.id.stale` file left by a crash during a takeover). On Windows the rename is retried a few times when antivirus or a sync client briefly holds the target. The new file gets the default permissions, not the old file's.
- _Lock._ `<file>.lock` is created with "fail if it exists", so two apps never both take it. It holds the computer's name, the process id, a per-run id and the time. A lock is stale when its process has died on this computer, or after 24 hours when it came from another computer, which cannot be asked. A stale lock is reported, and replaced only when the renderer asks with `takeOverStale` after telling the person. A normal quit releases the app's locks. Replacing a stale lock moves it aside and checks it first, and puts back a live lock that another app created in the meantime; two apps replacing the same stale lock in the same instant can still both fail, which is accepted. A process id reused after a crash keeps a lock looking live until the next restart.
- _Backups._ Each file gets a folder under `<app data>/backups`, named by a hash of its path (resolved, and case-folded where the file system ignores case), holding copies named `name_<UTC time to the second>.ext` (such as `Household 2026_20261126-024500.folio`; a second backup in the same second becomes `…_2.ext`, then `_3`, numbered above the highest in use, and backups of one file are written one at a time); the newest 10 stay (`BACKUPS_KEPT`; the backup just written is never the one deleted, even if the clock moved backwards; until the backup settings arrive with the app shell plan). Nothing is written beside the budget file.
- _Paths._ The renderer may name only files the person chose: the native dialogs return a path and the main process remembers it (`PathGrants`); every operation refuses any other path with `permissionDenied`. Logs carry sizes, counts and outcomes, never names, paths or contents. The context bridge copies only an error's message, so the failure code travels as a `[code]` prefix that `hostErrorCode` reads.

_File session (Setup and accounts milestone 3)._ The renderer opens and saves through one `FileSession` (`packages/renderer/src/session/`), which wraps `FileStore`, the codec and the lock so screens never see bytes or stamps. `create` asks for a location with the save dialog, takes the lock, writes an empty budget and backs it up, so the file exists, is locked and is safe before the first edit. `open` takes the lock, reads and decodes, then backs up the bytes it read; a file that fails to decode is never backed up, so a damaged file cannot push good backups out of the rotation. The previous file is released only when the new one has opened. Every failure is a typed value with a plain message that repeats nothing from the file (`session-messages.ts`). A damaged file offers its newest backup through `latestBackup`, which the main process grants for reading like any file the person chose; `openBackup` opens it bound to the damaged file, so a save replaces it. `save` passes the stamp from the last read and turns `changedOnDisk` into the warning of AD-12, never an overwrite. Decode failures and other outcomes reach the log through `HostApi.logFileEvent`: a closed list of events (a code, a count, a flag), so a log line cannot carry a name, a path or an amount whatever the page sends.

## AD-19. The platform is one interface: HostApi and FileStore

_Context._ The renderer and the core must not depend on Electron, so a read-only web build, a mobile wrapper, a mock for tests and a server-backed store can all slot in.

_Decision._ The renderer reaches the operating system only through a `HostApi` defined in the `host-api` package: open and save dialogs, reading and writing file bytes, an atomic save, lock acquire and release with stale-lock detection, backups, app-data settings, native menu events, file-drop events, reveal in folder and quit. Electron implements it with a preload bridge and main-process handlers; the renderer sees only that interface. Budget storage sits behind a narrower `FileStore` (open, save, lock, back up) so the data source can change without touching the screens.

- _Desktop._ The main process does the file work: write a temporary file, flush, rename over the target (AD-12). A native file drop event supplies paths for CSV import. The core runs in the renderer's main thread; file bytes pass over the bridge. A worker stays possible because the core has no DOM or Node dependency, and the performance initiative can decide it with real 10-year measurements (decided at the scaffold, 2026-11-13).
- _Web, later and read-only first._ A browser implementation reads a `.folio` file picked with a plain file input and parses it locally with no upload, so it works in every browser without the File System Access API. There is no save, no lock and no native menu there.
- _Server backend, later._ A household-hosted server is another `FileStore` implementation, opt-in and controlled by the household. It is not built and not designed in v1; the interface is the only preparation, and the data layer avoids assuming a local file where that costs nothing. When it arrives, H1.12 is reworded, the content security policy allows exactly that origin, and the AD-18 capture allowlists it.
- _Mobile, later._ A wrapper around the same renderer is possible. It is not evaluated.

_Menus and drops (Electron foundations milestone 3)._ Windows and Linux have no menu bar; the hamburger menu in the page (H1.14) is the menu. macOS gets a native menu, kept to the minimum of H1.16 for now (`buildMacMenuTemplate`: Folio with About, Settings and Quit; File with Save, for Cmd+S; Edit with Undo and Redo as Folio commands and the system cut, copy, paste and select-all roles). The other file commands (New, Open, Save As, Close file, Import CSV) join when files can be opened. Folio commands go to the focused window (the only window, when none is focused) as `MenuCommand`s and reach the page through `HostApi.onMenuCommand`, the same door the hamburger menu uses. Undo and Redo are not system roles because they change the budget; the page decides when a focused text field takes them instead. The macOS daily run clicks every Folio menu item through the automation commands and checks that each command reaches the page, and reads the shortcuts from the built menu; real key presses on the shortcuts are not in the regular run (a page-level key event does not reach the native menu). A one-off run on 2026-11-26 showed a hosted macOS runner does let `osascript` and System Events press Cmd+S, Cmd+Z, Cmd+Shift+Z and Cmd+, and that each reaches the page; the experiment was then removed, and can be recovered from the history of the pull request that added it.

Dropped files: the sandboxed page cannot read a dropped file's path, so the preload watches the window for a drop the user made (a trusted event; a script's synthetic drop is ignored), reads each file's real path with `webUtils.getPathForFile`, and tells the main process. The main process keeps only absolute paths of `.csv` files (at most 50), grants them like dialog results, logs the counts, and sends the references back to the page through `HostApi.onFilesDropped`. _Known conflict._ The preload cancels the browser's default for any drag that carries files (otherwise the window would navigate to the file), and it does not stop the event, so a drop zone in the page still sees it, but without a path. Drags inside the page carry no files, so in-page drag and drop (for example reordering) is unaffected; a page feature that wants to accept files must use `onFilesDropped`, not the DOM `File` objects.

_Consequences._ Every feature that touches the file system or the OS goes through the interface and has a mock. The Tauri slice showed a second host can be written in about a hundred lines of Rust plus a thin adapter, which is the check that the boundary holds.
