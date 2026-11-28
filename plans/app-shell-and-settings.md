# Plan: App shell and settings

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

Folio behaves like a document editor: a start screen with the last file and its status, a navigation pane and command bar, autosave and manual save with a visible state, undo and redo that survive saving, a Settings page, and backups with a way back from a corrupt file. This is area H of the [product requirements](../knowledge/product/month-end-review-shell.md).

## Scope

- In: the start screen (H1.1 to H1.3); the navigation pane and command bar (H1.4, H1.5); autosave, manual save, the unsaved indicator, immediate saves and the close prompt (H1.6 to H1.6c); undo and redo (H1.7, H1.8); the Settings page assembled from each plan's sections and the machine settings (H1.9); backup interval, retention and location settings and the Open-a-backup flow (H1.10, H1.11); the remaining menu entries (H1.14, H1.15).
- Out: the main-process save, lock, backup copy and menu code (done in [Electron foundations](electron-foundations.md) milestones 2 and 3); the automation hook (H1.17, AD-16, Electron foundations milestone 4); the content of the Overview, Reporting and Net worth pages; the sections of Settings other plans own (provider profiles and suspicious thresholds in CSV import, the transfer window in transfers, review thresholds in month-end), which this plan hosts but does not write.

## Approach

Decisions are AD-1 (the file is a document in memory, so Discard is "drop the model"), AD-5 (undo replays month-tagged change sets), AD-11 (file versus machine settings), AD-12 (backups, lock, change check), AD-21 (layouts by profile and width). Affected arc42 sections: 03, 04, 09.

1. _Undo is a stack of change sets_ the commands already produce. Undo applies each part's inverse; closing a month removes that month's parts from every entry (AD-5); an entry whose only parts are removed is dropped; the one unsplittable case (a pair across a closed and an open month) stops undo with a message naming the month. Saving never clears the stack (H1.7). Reopen and close are not undoable (M1.14).
2. _Dirty state and autosave are pure_: a function from (last saved version, current version, interval, minimum gap, last save time, now) to "save now", "wait" or "schedule at time T", tested with a fixed clock. A save that is due but falls inside the minimum gap since the last save is not dropped: it is scheduled for the moment the gap ends, and further requests before then join that one scheduled save, so many imports in a row become one save. Autosave and the save after a confirmed import honour the gap. Close and reopen of a month still save at once, and a manual save and the close prompt are never delayed (H1.6b as narrowed in Decisions).
   2a. _Saving never blocks the person._ The model is immutable (AD-1), so a save takes the current version as a free snapshot, encodes it off the UI thread in a worker, and hands the bytes to `FileStore.save`, which is async in the main process. The person keeps editing, scrolling and importing throughout; edits made while a save runs leave the file dirty at a newer version and are picked up by the next save. One save runs at a time, and requests that arrive during one join a single follow-up. The indicator changes quietly (Saving, then Saved or Unsaved changes) with no modal, spinner over the page or lost focus; a failure appears as a non-blocking message bar and leaves the file dirty. This moves the encoding of saves off the renderer's main thread, which the [app scaffold plan](app-scaffold.md) left to the performance initiative; it applies to save only, not to open.
3. _Machine settings_ (theme, autosave interval, minimum gap between saves, auto-open, recent files, backup location and interval) stay in the machine settings reader; file settings (AD-11) are edited as commands so they are undoable and audited.
4. _The Settings page is a list of sections_ each owning plan registers; this plan adds Appearance, Saving and backups, and About, and the page's own shell. The sections keep their component tests in their own plans.
5. _A corrupt, missing or unreadable file_ shows the error and offers the newest backup; choosing one opens it as a new session and never overwrites the damaged file (H1.11, building on the failure codes of the setup plan).
6. _Backup policy_ replaces the interim of AD-12: a backup on open, then at an autosave that wrote changes when at least X minutes have passed since the last backup (default 15, a machine setting), the newest 20 kept (Decisions); the location stays a machine setting.

## Milestones

Depends on: [setup and accounts](setup-and-accounts.md) milestone 3 (`FileSession`); [month-end review](month-end-review-and-locking.md) milestone 3 (month-tagged close, for the undo rule). Milestones 1 and 2 are pure and need only the command seam, so they can start once the month tags exist.

### 1. Undo and redo

- Does: the history stack, undo and redo of change sets, the month-removal rule, the stop-with-message case, and the toolbar and menu state (enabled or not, with the action's name).
- Acceptance criteria: the January, February, March example of AD-5 walks back through all February work after January closes; undo never changes a locked month; redo is cleared by a new edit; saving keeps the stack; an import is undone as one step except for rows in months closed since.
- Verified by: unit and property tests (apply then undo restores the model).

### 2. Save state, autosave and the close prompt

- Does: the dirty indicator, the autosave decision, manual save (menu and Ctrl or Cmd+S), the immediate saves, Save, Discard or Cancel on close, the changed-on-disk warning surfaced from AD-12, and the in-use lock warning.
- Acceptance criteria: saving a 30,000-transaction fixture household never blocks the UI thread for more than a stated time (proposed 50 ms per task, measured with the long-task API in an integration test); typing, scrolling and a command made during a save work and are in the next save, not lost or half-saved; a second request during a save produces one follow-up save; the indicator shows Saving and Saved without moving focus; a failed save shows the message bar and keeps the file dirty; closing the app during a save waits for it and then prompts only if newer changes exist; with a fixed clock, autosave fires exactly at the interval and only when dirty; closing with changes prompts; Discard drops the model; autosave never fires twice within the minimum gap; an import confirmed inside the gap leaves the file dirty and schedules one save for when the gap ends, and three imports inside it produce one save; a scheduled save is cancelled by a manual save and not repeated; a month close or reopen inside the gap saves at once; a refused save never leaves the indicator clean; a changed-on-disk file is not overwritten.
- Verified by: unit tests and integration tests on real temporary files.

### 3. The start screen and the navigation

- Does: the start screen (last file, status tiles, recent files with lock state, Open another, New), the option to open the last file at launch, the navigation pane and command bar wired to every page, the hamburger entries and their non-menu routes (H1.14, H1.15), and the month picker.
- Acceptance criteria: the status tiles match the model (open month, items to review, accounts waiting, last month closed); recent files that no longer exist or are locked say so; every page is reachable by keyboard; layouts follow the width classes (AD-21); light and dark screenshots.
- Verified by: component tests, the integration matrix of profiles and widths, an end-to-end scenario.

### 4. The Settings page

- Does: the page shell and section registry, the sections this plan owns (theme, autosave interval, minimum gap between saves, auto-open, backup interval and retention, About), and the registration of every other plan's section.
- Acceptance criteria: a household setting edit is undoable and saved with the file; a machine setting edit is not in the file; defaults and reset work; online lookups appear as planned and off (H1.9).
- Verified by: component tests and an integration test.

### 5. Backups and the corrupt-file flow

- Does: the backup policy in the host, the retention and location settings, listing backups for a file, and Open a backup from the error dialog and the start screen.
- Acceptance criteria: a backup is made on open, and at an autosave that wrote changes only when at least the configured minutes (default 15) have passed since the last backup, tested with a fixed clock; a manual save never makes one by itself; retention deletes the oldest only and never the one just written; opening a backup leaves the damaged file untouched; the error names the failure code and never content.
- Verified by: integration tests on real temporary folders on Windows and macOS.

### 6. Records and documents

- Does: AD-5 and AD-12 updated as built, the design notes, the PRD assumptions closed where decided, arc42 `key_files`, the README and the one-page household instructions where they list settings.
- Acceptance criteria: all checks and test kinds pass.
- Verified by: CI.

## Requirements

- Privacy: recent files and backup paths are machine data; logs carry counts and outcomes, never names or paths (AD-12).
- Security: a backup is read with the same schema checks as any file; a path comes only from a dialog the person used (`PathGrants`).
- Logging: save, autosave, backup and restore outcomes at Info; refusals (changed on disk, lock held) at Warn, by code.
- Accessibility: focus order and names for the start screen, navigation, command bar and the three-way close prompt.

## Risks

- Undo is planned last but every earlier plan produces change sets for it. Mitigation: all plans tag parts per AD-5 from the first command, and milestone 1 of the setup plan already inverts exactly; a gap found here is a fix in the owning plan.
- Autosave while a dialog is half-complete could save a partial import. Mitigation: only confirmed commands change the model; dialogs hold their own state.

## Decisions

Answered by Jeremy, 2026-11-28:

1. The order stays: navigation, command bar and the Settings shell are built in this plan; earlier plans add pages to the existing shell, and the Settings shell lands with CSV import milestone 6, which this plan adopts.
2. Backups are made on open, then at an autosave that wrote changes if at least X minutes have passed since the last backup; X is a machine setting in Settings with a default of 15 (revised by Jeremy, 2026-11-28, from every autosave). The newest 20 are kept; the count is a proposal and, at 15 minutes, spans about five hours of continuous work, so a longer-reaching rule may be wanted. The host's rotation and the 10-copy interim of AD-12 are updated to match.
3. The start screen shows whether other recent files are locked, by reading the sidecar lock read-only.
4. A minimum gap between saves, a machine setting with a default of 5 minutes, applies to autosave and to the save after a confirmed import. A save due inside the gap is scheduled for when the gap ends, so a burst of imports makes one save. This narrows H1.6b (imports no longer save at once) and the [CSV import plan](csv-import.md) milestone 5 says "immediate save after a confirmed import"; that plan is not changed here and needs the same wording when this one is approved. Closing and reopening a month still save at once, and manual save is never delayed.
5. Saves are asynchronous and seamless: encoding runs in a worker and the write is async, so a save never blocks the UI (the approach is item 2a under Approach; the long-task limit is a proposal to confirm at milestone 2).
