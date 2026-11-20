# Plan: Diagnostic logging

| Field       | Value                                |
| ----------- | ------------------------------------ |
| Status      | In progress (milestones 1 to 3 done) |
| Approved by |                                      |
| Created     | 2026-11-16                           |

## Goal

Make the main-process logger good enough to debug a failure on a household machine: log errors with their stack traces, never lose a line to a failing write, and keep a log file where a packaged app can be read afterwards. Diagnostic logs still carry no financial data and no personal data (AD-10, AD-18).

## Scope

- In, done: `apps/desktop/src/main/logger.ts` (error logging, a write that never throws), a stack scrubber, a small rotating file sink, the call sites in `main.ts` and `ipc.ts`, and logging of uncaught errors.
- In, next: error messages (own errors as written, third-party messages masked), per-field privacy and a developer-only unredacted switch (milestones 4 to 6). Sealed details that only the owner can decrypt are milestone 7, last and optional.
- Out, for now: everything under "Later" below. Each item is recorded there so it is not forgotten; none is started.
- Out for good: uploading logs (nothing leaves the computer, H1.12).

## Approach

The proposal was to log errors as name plus stack frames only, with the message line removed and paths made relative to the app. That holds up, with these changes:

1. _Keep frames only, not "stack minus the first line"._ A stack's message can span several lines, and the message is where data hides (a parse error quoting a value). The scrubber keeps only lines that start with `at ` and rebuilds each frame, so nothing else survives.
2. _Paths: the app folder is kept, everything else is cut to the file name._ A path below the app folder (`<app>/main.cjs:120:5`) shows code layout and no one's data, so it keeps its folders. A path below the user's home folder, the temp folder or anywhere unknown can carry a user name or a folder name chosen by a person, so it keeps only the file name, line and column. This is stricter than "strip the roots" and cannot leak a folder that nobody thought to list. Backslashes, drive letters, UNC paths, `file://` URLs (percent-decoded before matching) and a different case of a drive letter are all understood. The roots are passed in, so the logger stays free of Electron and `node:os`.
3. _Name and code are checked, not trusted._ `name` is kept only if it looks like an identifier, else `Error`. A `code` such as `ENOENT` is kept when it looks like one: it is the most useful fact about a file-system failure and it carries no data. `message`, `path`, `syscall` and every other property are never read.
4. _Thrown values that are not errors_ (a string, an object, `undefined`) are logged as `NonError` plus their `typeof`, never their content.
5. _Limits._ A frame is cut at 200 characters, a stack at 20 frames, and a cause chain at 3 causes below the error. These are judgement, not measured. They are separate from the 120-character field limit, which stays as it is. A cut is marked (`truncated`), so it is not mistaken for the whole story.
6. _Where the line goes._ The log line gets an `error` object next to `fields`, so errors never share a key with caller fields.

Robustness gaps reviewed:

| Gap                                                                                                                                    | Decision                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A throwing `write`, a throwing `now`, or a hostile getter on an error (`stack`, `cause`) could crash the app, or hang a request filter | Done: building and writing a line is wrapped; on failure the logger tries one fixed-text line and then gives up silently. |
| An error on `process.stderr` (for example EPIPE when the parent closed the pipe) is an unhandled `error` event and crashes the app     | Done: `main.ts` handles it.                                                                                               |
| Packaged builds have no console, so stderr is lost                                                                                     | Done: a log file (below).                                                                                                 |
| Level from `FOLIO_LOG_LEVEL`                                                                                                           | Already case-insensitive and trimmed; unchanged.                                                                          |
| Control characters, newlines, quotes in text                                                                                           | Already safe: `JSON.stringify` escapes them. Tested.                                                                      |
| Messages and fields may still be written with data by a caller                                                                         | Cannot be checked by the logger; the rule stays in the `LogFields` comment and in review.                                 |
| `AggregateError.errors`, `Error.stackTraceLimit` (V8 keeps 10 frames by default), async stack traces                                   | Not handled; ten frames is enough for now.                                                                                |

_Log file._ Needed now: the stack traces are of little use if a packaged app, which has no console, throws them away. The file is `folio.log` in `<userData>/logs`, written only in packaged builds (a developer has the terminal, and the end-to-end tests point `userData` at a temporary folder). Lines are appended synchronously, because the last line before a crash, `startup failed`, must reach the disk before `app.exit`. When the file would pass 1 MB it is renamed to `folio.log.1` and the older `.1` becomes `.2`; the old `.2` is deleted, so at most 3 MB are kept. Stderr still gets every line. The sink takes its file operations as an argument, so its unit tests need no real folder. Logs are never uploaded and are not part of a budget file or its backups.

## Milestones

### 1. Errors and a logger that never throws (done)

- Does: `logError` on the logger, the stack scrubber, the limits, the throw-proofing and the `main.ts` and `ipc.ts` call sites. `hardening.ts` needs no change: its one log call carries no error, and the logger's new guarantee is what protects the request filter.
- Acceptance criteria: unit tests with a fixed time source cover Windows and macOS path shapes, a message with data that must not appear, nested causes, non-error values and a throwing write.
- Verified by: lint, format check, type check, the architecture checks and the unit tests.

### 2. The log file (done)

- Does: the rotating file sink and its use in packaged builds.
- Acceptance criteria: unit tests over an in-memory file system cover appending, rotation, the backup cap and recovery after a failed operation; an integration test on a real temporary folder rotates a real file. That a packaged app writes `logs/folio.log` is not yet checked by the end-to-end smoke test.
- Verified by: the unit and integration runs.

### 3. Uncaught errors (done)

- Does: `installErrorHandlers` logs uncaught exceptions and unhandled rejections with `logError`, shows one fixed-text error box (later errors are logged only, so a loop cannot bury the window in dialogs), and keeps the app running. This replaces Electron's default dialog. Chosen for now and open to change (Jeremy, 2026-11-19): continuing after an unknown error can hide a broken state, so exit-after-logging is the alternative.
- Acceptance criteria: unit tests with a fake event source cover both events, non-error reasons, one box for several errors, and a box that throws.
- Verified by: lint, format check, type check, the architecture checks and the unit tests.

### 4. Positions, not values, and per-field privacy

Why: the cheapest way to keep a useful message free of data is to never put the data in it. No crypto is needed for this.

- Does: a `FolioError` class whose message follows a message standard (fixed text plus ids, counts, dates, row and column numbers and file hashes, never a value) and is logged as written, also when it is a `cause`; code that catches a third-party error wraps it in a `FolioError` and keeps the original as the cause. Log fields get a per-field privacy mark, as in Apple's `os_log`: a plain value is written, an unmarked string stays hidden as today, and a field marked private is dropped until milestone 7 can seal it.
- Acceptance criteria: unit tests that a `FolioError` message is written as is and a third-party cause is not; a private field never appears in a line; existing field behaviour is unchanged.
- Verified by: the unit run; AD-10 and this plan updated for the message rule. Whether the message standard also goes in `project-standards.md` is Jeremy's choice (not a stack rule).

### 5. Masked third-party messages

- Does: vocabulary masking for every message that is not a `FolioError`'s. Quoted text is masked, a word is kept only if it is in a fixed list of error words, everything else becomes `<?>`, and a number is kept only after `position`, `line`, `column` or `index`. The masker fails closed: a word it does not know is hidden, not shown.
- Acceptance criteria: a test set of messages that hold data (amounts, account numbers, names, merchants, file names, emails, IBANs) in several shapes, none of whose values survive; `TypeError` and `ENOENT` style messages keep their structure.
- Verified by: the unit run.

### 6. Developer-only unredacted switch

- Does: `FOLIO_LOG_UNREDACTED=1` writes plain messages and raw stacks to the log. The code ignores the variable in packaged builds, so a household machine cannot be set to write personal data in the clear.
- Acceptance criteria: a test that the switch works unpackaged and is ignored when packaged.
- Verified by: the unit run.

### 7. Sealed details with age (last, optional)

Do this only if milestones 4 to 6 leave failures that cannot be debugged without the raw values. Nothing before it depends on it.

- Does: when `FOLIO_LOG_SEAL_KEY` holds an age recipient (`age1...`), each logged error and each private field also carries a sealed blob with the raw details, written in the [age](https://jsr.io/@age/age-encryption) format, so the stock `age` command can open it. The recipient is issued per install and per version from a master secret the owner holds: a release secret is `HKDF(master, version)`, the install key is `HKDF(release secret, install id)`, and a token holds only the public recipient. The install id is a random UUID kept in the user-data folder, not taken from the hardware. A script (`init`, `issue`, `decode`) re-derives keys on demand; it takes the master secret from an environment variable filled by Bitwarden Secrets Manager, so the secret is never typed, saved or printed. The derivation is frozen as a written spec with known-answer test vectors, and each blob names its app version, install id and master id in the clear. Off by default.
- First task: check the `age-encryption` package against the dependency rules (licence, install scripts, size, release age) and that it bundles into `main.cjs`.
- Acceptance criteria: a round trip with a generated key; a wrong key fails; the stock `age` command opens a blob; with the variable unset nothing is sealed; AD-10 amended ("no personal data in the clear; sealed details only when enabled").
- Verified by: the unit run and a decode of a real log by hand.

## Later

Recorded so they are not lost. None is scheduled. The ones that are plans of their own (the Settings toggle, an in-app logs command) are also listed in [PLANS.md](../PLANS.md).

| Item                                                                                                                                                     | Why it waits                                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A Settings toggle ("include protected details in diagnostics") in place of the `FOLIO_LOG_SEAL_KEY` variable                                             | Touches the settings schema (AD-11) and the UI; the household is not technical, so this is the real switch |
| Known-template extraction for third-party errors (rebuild the message of a `TypeError`, a Node system error or a `JSON.parse` error from its safe parts) | Only if vocabulary masking loses too much                                                                  |
| A message hash for grouping repeated failures (needs a random per-install salt, because a hash of a short value can be guessed)                          | Not needed until repeats are hard to count                                                                 |
| Source maps for the main bundle (decided: wait)                                                                                                          | Packaging work                                                                                             |
| `AggregateError.errors`, `Error.stackTraceLimit`, async stack depth                                                                                      | Ten frames is enough for now                                                                               |
| An end-to-end check that a packaged app writes `logs/folio.log`                                                                                          | Needs a packaged run                                                                                       |
| An "open logs folder" or "copy diagnostics" command in the app                                                                                           | Needs UI and the menu plan                                                                                 |
| Logging in the renderer and the preload script                                                                                                           | Needs a bridge and its own privacy review                                                                  |
| A log file in unpackaged runs                                                                                                                            | A developer has the terminal                                                                               |

## Requirements

- No financial data and no personal data in any log, including paths and error messages (AD-10, AD-18).
- Sealed details, if built, are written only when the owner's variable is set, and only keys derived from the owner's master secret open them.
- Logging never changes what the app does: it cannot throw, and it adds no network access.

## Decisions

- Frames only, app-relative paths, everything else cut to the file name (Engineer, 2026-11-16; proposal changed from "strip the install, home and temp folders").
- A log file under the user-data folder in packaged builds, with 1 MB size rotation and two backups (Engineer, 2026-11-16; the owner asked for the decision to be made here).

- Sealing raw error details in the age format, issued per install and version from an owner-held master secret, enabled by an environment variable, with a Settings toggle later; milestone 7, last and optional (Jeremy and Engineer, 2026-11-19).
- Only Jeremy has access to the master secret for now, and that is accepted: if that access is lost, every sealed log becomes unreadable. Revisit before milestone 7 if a second person needs to decode logs (Jeremy, 2026-11-19).
- Uncaught exceptions and unhandled rejections: log, show one error box, keep running (Jeremy, 2026-11-19).
- Source maps for the main bundle wait for the packaging work (Jeremy, 2026-11-19).
- The message standard lives in AD-10 and this plan, not in `project-standards.md` (Jeremy, 2026-11-19).
- The end-to-end check of `logs/folio.log` stays in Later (Jeremy, 2026-11-19).
- The master secret is stored in Bitwarden Secrets Manager (Jeremy, 2026-11-19). The key script reads it from an environment variable supplied by the secret manager's command-line tool, and never writes it to a file, a log or the repository. It is not given to CI.
- Order: positions-not-values and per-field privacy first, masking second, the developer switch third, sealing last (Jeremy, 2026-11-19).
- Messages: own errors as written, third-party messages masked by vocabulary, known-template extraction left for later (Jeremy and Engineer, 2026-11-17).

## Open questions

None.
