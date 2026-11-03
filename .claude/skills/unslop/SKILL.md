---
name: 'unslop'
version: '0.1.0'
description: 'Detects and rewrites AI-sounding patterns in documentation so the prose is plain, specific, and direct.'
---

## Purpose

Removes AI writing tells from any prose: docs, READMEs, PR text, comments, pasted text, and the agent's own chat output. A script finds the mechanical patterns; the agent fixes those and the judgment patterns below. Meaning and facts never change.

## Inputs

- *Text to clean.* Any one of: files (default: files the current change adds or edits), text the user pasted, or a draft the agent is about to send in chat. No file is required.

## Steps

### Step 1: Scan

For files, run `node scripts/scan.js <file...>` from this skill's directory. For text with no file (pasted text, a chat draft), pipe it on stdin: `node scripts/scan.js <<'EOF'` followed by the text and `EOF`. Output is `file:line [category] "match" -> fix`, with `<stdin>` as the name for piped text. The scan skips frontmatter, fenced code, and inline code. Exit code 1 means findings, 2 means a file or usage error. If no shell or Node is available, skip the script and apply Step 3 to the text directly; the rules do not depend on it. Rule of three, passive voice, and title case are advisory; judge each hit in context. The word and phrase lists live in `scripts/patterns.json`; extend that file, not the script.

### Step 2: Fix scan findings

Rewrite each flagged line per the table. Do not swap one tell for another ("crucial" to "pivotal"). If the sentence says nothing without the phrase, delete the sentence.

### Step 3: Apply the judgment patterns

Read the text for what the scan cannot see. Rules by area:

*Content*
- Superficial -ing phrases: cut trailing "highlighting...", "ensuring...", "reflecting...", "underscoring..." clauses. Keep only if they add a fact; then make it its own sentence.
- Vague attribution: "experts say", "reports suggest", "it is widely believed". Name the source or delete the claim.
- Promotional or significance claims ("pivotal", "testament to", "plays a key role") with no fact behind them: state the fact.

*Language*
- AI vocabulary: replace or delete per `scripts/patterns.json`.
- Fancy "is": "serves as", "stands as", "boasts", "features", "represents" become "is" or "has".
- "Not just X, but Y" and "It's not X, it's Y": state Y.
- Rule of three: list only the items that exist. Split forced triplets of adjectives or nouns.
- Synonym cycling: name a thing once, then reuse the same word for it in the paragraph.
- False ranges: "from X to Y" only when X and Y sit on a real scale. Otherwise list the items. (The scan does not detect this; look for it.)

*Style*
- Em dashes: replace with a period, comma, colon, or parentheses. Zero by default.
- Colons: only before a list or a definition, never to join clauses mid-sentence. (The scan does not detect this.)
- Bold: only for UI labels and warnings that must not be missed. Never for proper nouns, acronyms, or emphasis.
- Inline-header lists ("bold Label: text" where the text restates the label): rewrite as prose, with an italic lead-in if a label is needed (`*Schema in C#.* All tables live in one file.`).
- Headings: sentence case. Keep proper nouns and acronyms capitalized.
- Emojis: remove from headings and bullets.
- Quotes and apostrophes: straight only.

*Communication artifacts*
- Remove chatbot phrases ("I hope this helps", "Let me know if", "Certainly!", "Here is a...").
- Remove sycophancy ("Great question", "You're absolutely right"). Answer directly.
- Remove knowledge-cutoff disclaimers and "as an AI" text.

*Filler*
- Shorten wordy phrases per `scripts/patterns.json` ("in order to" to "to", "due to the fact that" to "because").
- Hedging: one hedge per claim, and only if the uncertainty is real. "Could potentially" becomes "may".
- Generic conclusions ("The future looks bright", "In summary", "Overall"): replace with a specific next step or fact, or delete.

*Jargon*
- Abstract metaphor nouns: substrate (base), wedge or "wedge in" (add), vector (way, method), locus (place), and the rest of the list in `scripts/patterns.json`. Use the literal word.

*Plain speech*
- Say what it does, not how it feels or how impressive it is.
- Split sentences over about 25 words or with more than one idea.
- Prefer active voice; name the actor.
- Cut adverbs or use a stronger verb ("runs quickly" to "is fast").
- Prefer the plain word ("utilize" and "leverage" to "use", "facilitate" to "help").
- Mannered prose: replace metaphor or flourish with the literal phrase.
- Over-compression: restore dropped articles, verbs, and spelled-out terms; replace `->`, `&`, and undefined abbreviations the reader must decode. Do not overcorrect into the other patterns.

### Step 4: Verify

Re-run the scan; it must report no findings except intentional ones (state them). Re-read the result against the original: every fact, number, name, and instruction is preserved, and no new tell was introduced.

## Outputs

- Edited files, or for text with no file, the rewritten text returned in chat. Add a one-line summary of what changed and any findings left in place with the reason.

## Edge Cases

- *Quoted or verbatim text* (user quotes, error output, legal text) stays unchanged.
- *Code, commands, identifiers, and frontmatter* are never edited; the scan skips them.
- *A flagged word that is correct in context* ("additionally" in a real contrast, "landscape" as a page orientation) stays; say so.
- *Dense reference tables* are not expanded into prose; apply only the word-level rules.
- *A rewrite that would change meaning* is left alone and flagged for the author.
- *Required template sections* (PR template headings) keep their structure; clean only the content.
