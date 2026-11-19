# Plans

The high-level list of what is planned or under way. One line each; the detail lives in the linked plan. An idea that is not being done now still gets a line, so it is not forgotten.

## In progress

- Diagnostic logging: errors with safe stack traces and a log file are done; messages, per-field privacy and a developer-only unredacted switch are next; encrypted details (age) come last and are optional. [plans/logging.md](plans/logging.md)

## Planned

- App scaffold. [plans/app-scaffold.md](plans/app-scaffold.md)
- Electron foundations: privacy capture, host implementations, web check, installers. [plans/electron-foundations.md](plans/electron-foundations.md)
- UI regression suite. [plans/regression-suite.md](plans/regression-suite.md)

## Later

- Logging: a Settings toggle for protected diagnostic details, in place of the `FOLIO_LOG_SEAL_KEY` variable.
- Logging: uncaught exceptions and unhandled rejections.
- Logging: an in-app "open logs" or "copy diagnostics" command.
