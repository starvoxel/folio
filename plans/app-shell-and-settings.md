# Plan: App shell and settings

| Field       | Value      |
| ----------- | ---------- |
| Status      | Draft      |
| Approved by |            |
| Created     | 2026-11-28 |

## Goal

Folio behaves like a document editor: a start screen with the last file and its status, a navigation pane and command bar, autosave and manual save with a visible state, undo and redo that survive saving, a Settings page, and backups with a way back from a corrupt file. This is area H of the [product requirements](../knowledge/product/month-end-review-shell.md).

## Scope

- In: the start screen (H1.1 to H1.3); the navigation pane and command bar (H1.4, H1.5); autosave, manual save, the unsaved indicator, immediate saves and the close prompt (H1.6 to H1.6c); undo and redo (H1.7, H1.8); the Settings page assembled from each plan's sections and the machine settings (H1.9); backup frequency, retention and location settings and the Open-a-backup flow (H1.10, H1.11); the remaining menu entries (H1.14, H1.15).
- Out: the main-process save, lock, backup copy and menu code (done in [Electron foundations](electron-foundations.md) milestones 2 and 3); the automation hook (H1.17, AD-16, Electron foundations milestone 4); the content of the Overview, Reporting and Net worth pages; the sections of Settings other plans own (provider profiles and suspicious thresholds in CSV import, the transfer window in transfers, review thresholds in month-end), which this plan hosts but does not write.

## Approach

Decisions are AD-1 (the file is a document in memory, so Discard is "drop the model"), AD-5 (undo replays month-tagged change sets), AD-11 (file versus machine settings), AD-12 (backups, lock, change check), AD-21 (layouts by profile and width). Affected arc42 sections: 03, 04, 09.

1. _Undo is a stack of change sets_ the commands already produce. Undo applies each part's inverse; closing a month removes that month's parts from every entry (AD-5); an entry whose only parts are removed is dropped; the one unsplittable case (a pair across a closed and an open month) stops undo with a message naming the month. Saving never clears the stack (H1.7). Reopen and close are not undoable (M1.14).
2. _Dirty state and autosave are pure_: a function from (last saved version, current version, interval, now) to "save now" or wait, tested with a fixed clock. Close, reopen and a confirmed import save at once regardless (H1.6b).
3. _Machine settings_ (theme, autosave interval, auto-open, recent files, backup location) stay in the machine settings reader; file settings (AD-11) are edited as commands so they are undoable and audited.
4. _The Settings page is a list of sections_ each owning plan registers; this plan adds Appearance, Saving and backups, and About, and the page's own shell. The sections keep their component tests in their own plans.
5. _A corrupt, missing or unreadable file_ shows the error and offers the newest backup; choosing one opens it as a new session and never overwrites the damaged file (H1.11, building on the failure codes of the setup plan).
6. _Backup policy_ replaces the interim of AD-12: a backup on open and at every autosave, the newest 20 kept (Decisions); the location stays a machine setting.

## Milestones

Depends on: [setup and accounts](setup-and-accounts.md) milestone 3 (`FileSession`); [month-end review](month-end-review-and-locking.md) milestone 3 (month-tagged close, for the undo rule). Milestones 1 and 2 are pure and need only the command seam, so they can start once the month tags exist.

### 1. Undo and redo

- Does: the history stack, undo and redo of change sets, the month-removal rule, the stop-with-message case, and the toolbar and menu state (enabled or not, with the action's name).
- Acceptance criteria: the January, February, March example of AD-5 walks back through all February work after January closes; undo never changes a locked month; redo is cleared by a new edit; saving keeps the stack; an import is undone as one step except for rows in months closed since.
- Verified by: unit and property tests (apply then undo restores the model).

### 2. Save state, autosave and the close prompt

- Does: the dirty indicator, the autosave decision, manual save (menu and Ctrl or Cmd+S), the immediate saves, Save, Discard or Cancel on close, the changed-on-disk warning surfaced from AD-12, and the in-use lock warning.
- Acceptance criteria: with a fixed clock, autosave fires exactly at the interval and only when dirty; closing with changes prompts; Discard drops the model; a refused save never leaves the indicator clean; a changed-on-disk file is not overwritten.
- Verified by: unit tests and integration tests on real temporary files.

### 3. The start screen and the navigation

- Does: the start screen (last file, status tiles, recent files with lock state, Open another, New), the option to open the last file at launch, the navigation pane and command bar wired to every page, the hamburger entries and their non-menu routes (H1.14, H1.15), and the month picker.
- Acceptance criteria: the status tiles match the model (open month, items to review, accounts waiting, last month closed); recent files that no longer exist or are locked say so; every page is reachable by keyboard; layouts follow the width classes (AD-21); light and dark screenshots.
- Verified by: component tests, the integration matrix of profiles and widths, an end-to-end scenario.

### 4. The Settings page

- Does: the page shell and section registry, the sections this plan owns (theme, autosave interval, auto-open, backup policy, About), and the registration of every other plan's section.
- Acceptance criteria: a household setting edit is undoable and saved with the file; a machine setting edit is not in the file; defaults and reset work; online lookups appear as planned and off (H1.9).
- Verified by: component tests and an integration test.

### 5. Backups and the corrupt-file flow

- Does: the backup policy in the host, the retention and location settings, listing backups for a file, and Open a backup from the error dialog and the start screen.
- Acceptance criteria: a backup is made on open and at every autosave that wrote changes; retention deletes the oldest only and never the one just written; opening a backup leaves the damaged file untouched; the error names the failure code and never content.
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
2. Backups are made on open and at every autosave, keeping the newest 20 (the count is a proposal; the Settings policy may change it). The host's rotation and the 10-copy interim of AD-12 are updated to match.
3. The start screen shows whether other recent files are locked, by reading the sidecar lock read-only.
