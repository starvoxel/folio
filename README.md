# Stack selection spike (base branch)

Throwaway comparison of two technology stacks for Folio, a local-first household budget app: Avalonia (C#) and Electron with TypeScript. Both are built to the same small slice and measured against the same gates. Nothing here merges into `main`.

| Path                      | What it is                                                                 |
| ------------------------- | -------------------------------------------------------------------------- |
| `SLICE-SPEC.md`           | What to build, the pass/fail gates, what to measure, and the working rules |
| `RESULTS-TEMPLATE.md`     | Copy to `RESULTS.md` on your branch and fill it in                         |
| `fixtures/`               | Shared data: 10,000 transactions, accounts, categories, with `SHA256SUMS`  |
| `tools/generate-fixtures.py` | Seeded generator for the fixtures (Python standard library only)        |
| `prompts/`                | Kickoff prompt for each stack's session                                    |

Branches: `spike/stack-selection-base` (this one), `spike/slice-avalonia`, `spike/slice-electron`. The plan and background live on `claude/relaxed-volta-biy41e` (`plans/stack-selection-spike.md`, `knowledge/research/ui-framework-comparison.md`) and on `main` for the existing product and architecture docs.

Regenerate the fixtures (the result must match `fixtures/SHA256SUMS`):

```bash
python3 -I tools/generate-fixtures.py
sha256sum -c fixtures/SHA256SUMS
```
