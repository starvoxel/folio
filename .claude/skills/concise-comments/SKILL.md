---
name: 'concise-comments'
version: '0.1.0'
description: 'Shortens or writes code comments and JSDoc so they say why, not what, within the size limits in project-standards.md.'
---

## Purpose

Keeps comments and JSDoc short. The limits and enforcement are in `project-standards.md` ("Comments"); this skill is how to meet them. For wording, use `unslop` afterwards.

## Steps

1. For each comment, ask what a reader could not learn from the code and signature. Keep only that: a constraint, a decision, a trap.
2. Delete the comment if nothing is left. Do not keep it to satisfy `jsdoc/require-jsdoc`: write the shortest description that is true.
3. Cut by kind:
   - *Restates the name or type.* Delete the sentence. A tag may be a few words (`@param count - Rows to keep.`).
   - *Walks through the code.* Delete it, or rename or split the code so it reads without it.
   - *Explains a rule, convention or design.* Link the arc42 section or standard that owns it. Do not copy it.
   - *History or ticket narrative.* Delete it. It belongs in the commit message.
4. Check the limits: `//` 3 lines, JSDoc description 4, tag description 2. Run `npx eslint <file>`; the `folio/max-comment-lines` rule reports overruns.
5. When you fix a suppressed comment, run `npx eslint --prune-suppressions`.

## Outputs

The edited comments, with `max-comment-lines` clean for the file. Do not mass-edit comments outside the change you are making.
