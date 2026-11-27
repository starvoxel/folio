---
section: '09'
title: 'Architecture Decisions'
lifecycle: draft
tags: [decisions, adr]
key_files: []
---

> The architecture decisions agreed with Jeremy on 2026-11-05 and revised on 2026-11-12 for the Electron stack, each with its reason and what it costs. Numbering is stable; a superseded decision is marked, not deleted.

| ID                                                                                                     | Decision                                                      | Status                              |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------------- |
| [AD-1](09_01_domain_model.md#ad-1-the-whole-file-lives-in-memory)                                      | The whole file lives in memory                                | Accepted                            |
| [AD-2](09_02_file_and_host.md#ad-2-the-budget-file-is-a-zip-of-json-and-jsonl-parts)                   | The budget file is a zip of JSON and JSONL parts              | Accepted                            |
| [AD-3](09_01_domain_model.md#ad-3-one-classification-entry-point-frozen-at-close)                      | One classification entry point, frozen at close               | Accepted                            |
| [AD-4](09_01_domain_model.md#ad-4-every-change-is-a-command-checked-by-one-lock-guard)                 | Every change is a command, checked by one lock guard          | Accepted                            |
| [AD-5](09_01_domain_model.md#ad-5-undo-replays-month-tagged-change-sets)                               | Undo replays month-tagged change sets                         | Accepted                            |
| [AD-6](09_01_domain_model.md#ad-6-transactions-have-lines)                                             | Transactions have lines                                       | Accepted                            |
| [AD-7](09_01_domain_model.md#ad-7-money-dates-and-ids-have-their-own-types)                            | Money, dates and ids have their own types                     | Accepted                            |
| [AD-8](09_01_domain_model.md#ad-8-import-is-a-pipeline-of-pure-stages)                                 | Import is a pipeline of pure stages                           | Accepted                            |
| [AD-9](09_01_domain_model.md#ad-9-rules-run-in-a-computed-order)                                       | Rules run in a computed order                                 | Accepted                            |
| [AD-10](09_03_platform_privacy_logging.md#ad-10-an-audit-log-not-event-sourcing)                       | An audit log, not event sourcing                              | Accepted; details at implementation |
| [AD-11](09_02_file_and_host.md#ad-11-settings-split-between-file-and-machine)                          | Settings split between file and machine                       | Accepted                            |
| [AD-12](09_02_file_and_host.md#ad-12-backups-lock-file-and-on-disk-change-check)                       | Backups, lock file and on-disk change check                   | Accepted                            |
| [AD-13](09_04_ui_and_structure.md#ad-13-charts-are-echarts-behind-chart-models)                        | Charts are ECharts behind chart models                        | Accepted                            |
| [AD-14](09_04_ui_and_structure.md#ad-14-package-layout-ui-state-and-testing)                           | Package layout, UI state and testing                          | Accepted                            |
| [AD-15](09_04_ui_and_structure.md#ad-15-the-design-system-is-fluent-ui-react-v9-behind-app-components) | The design system is Fluent UI React v9 behind app components | Accepted                            |
| [AD-16](09_03_platform_privacy_logging.md#ad-16-testing-and-drivability-without-a-network-port)        | Testing and drivability without a network port                | Accepted                            |
| [AD-17](09_03_platform_privacy_logging.md#ad-17-electron-with-typescript-is-the-stack)                 | Electron with TypeScript is the stack                         | Accepted                            |
| [AD-18](09_03_platform_privacy_logging.md#ad-18-the-renderer-is-hardened-and-privacy-is-checked-in-ci) | The renderer is hardened and privacy is checked in CI         | Accepted                            |
| [AD-19](09_02_file_and_host.md#ad-19-the-platform-is-one-interface-hostapi-and-filestore)              | The platform is one interface: HostApi and FileStore          | Accepted                            |
| [AD-20](09_03_platform_privacy_logging.md#ad-20-windows-and-macos-packaging-unsigned-no-auto-update)   | Windows and macOS packaging, unsigned, no auto-update         | Accepted                            |
| [AD-21](09_04_ui_and_structure.md#ad-21-layouts-are-chosen-by-form-factor-profile-and-width-class)     | Layouts are chosen by form-factor profile and width class     | Accepted                            |

The decisions are grouped by theme: [09.01 domain model and rules](09_01_domain_model.md), [09.02 the file, backups and the host interface](09_02_file_and_host.md), [09.03 stack, privacy, logging and packaging](09_03_platform_privacy_logging.md) and [09.04 package layout, UI and layouts](09_04_ui_and_structure.md).
