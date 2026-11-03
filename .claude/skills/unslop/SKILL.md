---
name: 'unslop'
version: '0.2.0'
description: 'Detects and rewrites AI-sounding patterns in documentation so the prose is plain, specific, and direct.'
---

## Purpose

Removes AI writing tells from any prose: docs, READMEs, PR text, comments, pasted text, and the agent's own chat output. Detection runs by script when possible and by the agent's own reading when not; the catalog in Step 3 serves both. Meaning and facts never change.

## Inputs

- *Text to clean.* Any one of: files (default: files the current change adds or edits), text the user pasted, or a draft the agent is about to send in chat. No file is required.

## Steps

### Step 1: Detect

Choose the path by what is available. Both paths end with the same list of findings, each as `location [category] "match"`.

*Script path.* For files, run `node scripts/scan.js <file...>` from this skill's directory. For text with no file, pipe it on stdin: `node scripts/scan.js <<'EOF'` followed by the text and `EOF`. Output is `file:line [category] "match" -> fix`, with `<stdin>` as the name for piped text. The scan skips frontmatter, fenced code, and inline code. Exit code 1 means findings, 2 means a file or usage error, and 0 means the scan found nothing, not that the text is clean: it cannot see the judgment-only patterns marked "script: no" in Step 3. After a script run, still do the manual pass for those.

*Manual path (no shell, no Node, or the script fails).* The agent does the whole detection itself:
1. Read `scripts/patterns.json` with the Read tool. It needs no Node. Its `words`, `wordy`, and `regex` entries are the full term lists. If the file is unreadable, use the examples in Step 3 and add terms you recognize from the same families.
2. Make one pass per area in Step 3 (content, language, style, communication artifacts, filler, jargon, plain speech), in that order. Within a pass, check every entry in the area. Do not merge passes or stop at the first hit; a sentence often carries several tells.
3. For each entry, search the text for its Detect cues. For countable patterns (em dashes, bold spans, colons, emojis, curly quotes), count them across the whole text, not just the lines you happened to read.
4. Record each hit as `line [category] "match"`. For text without line numbers, use the paragraph number.
5. Judge each hit in context against Edge Cases before fixing.

### Step 2: Fix

Rewrite each finding per its Fix. Do not swap one tell for another ("crucial" to "pivotal"). If the sentence says nothing without the phrase, delete the sentence. A fix must not introduce a new finding: after rewriting a line, re-check it against the same catalog.

### Step 3: The catalog

Each entry gives the Detect cues, the Fix, and whether the script finds it. "Script: partial" means the script flags candidates and the agent decides; "script: no" means only the agent can find it.

*Content*

- Superficial -ing phrases (script: yes).
  - Detect: a comma followed by a participle that tacks significance onto a finished clause: ", highlighting...", ", ensuring...", ", reflecting...", ", underscoring...", ", showcasing...", ", emphasizing...", ", contributing to...", ", fostering...", ", paving the way...", ", cementing...", ", making it easier to...". Also sentence-final "-ing" clauses with no subject of their own.
  - Fix: cut the clause. If it carries a real fact, make it its own sentence with a subject and verb.
- Vague attribution (script: yes).
  - Detect: a claim credited to an unnamed group: "experts believe", "industry reports suggest", "studies show", "research suggests", "many believe", "some argue", "critics say", "observers note", "it is widely believed", "widely regarded as", "it is often said".
  - Fix: name the source (who, where, when) or delete the claim. Never invent a source.
- Significance and promotion without a fact (script: partial).
  - Detect: sentences that rate importance instead of describing: "plays a key role", "is a testament to", "pivotal moment", "setting the stage for", "a rich history", "vibrant", "stunning", "must-have", "a game changer", "continues to shape".
  - Fix: state the concrete fact the claim stands on, or delete it.

*Language*

- AI vocabulary (script: yes).
  - Detect: "additionally", "furthermore", "moreover", "crucial", "pivotal", "paramount", "delve", "enduring", "intricate", "tapestry", "landscape" (abstract), "interplay", "underscore", "showcase", "foster", "garner", "robust", "seamless", "comprehensive", "meticulous", "nuanced", "multifaceted", "holistic", "streamline", "elevate", "empower", "realm", "cornerstone", "beacon", "navigate" (non-literal), "journey" (non-literal), "myriad", "plethora", "notably", "importantly", "ultimately". Check inflections ("delves", "fostering", "showcased"). Full list: `words.ai-vocabulary` in `scripts/patterns.json`.
  - Fix: delete the word, or replace with the plain word ("important" only if it truly is, "also" for "additionally", "strong" for "robust").
- Fancy "is" (script: yes).
  - Detect: "serves as", "stands as", "acts as", "functions as", "boasts", "features a", "represents a", "marks a", "constitutes", "holds the distinction of".
  - Fix: "is", "are", or "has".
- "Not just X, but Y" (script: yes).
  - Detect: "not just X but Y", "not only X but also Y", "not merely...", "It's not X, it's Y", "This isn't about X; it's about Y".
  - Fix: state Y directly. Keep X only if the reader holds the wrong belief X and needs correcting.
- Rule of three (script: partial).
  - Detect: lists of exactly three adjectives, nouns, or clauses ("fast, reliable, and scalable"), especially when the third item is vague or repeats the others; three parallel sentences in a row.
  - Fix: keep the items that carry distinct facts. Two or four items are fine when that is what exists.
- Synonym cycling (script: no).
  - Detect: within a paragraph, one thing named by several words ("the tool", "the utility", "the solution", "the platform"; "users", "customers", "clients", "stakeholders").
  - Fix: pick the term the rest of the doc uses and repeat it. Pronouns are fine.
- False ranges (script: no).
  - Detect: "from X to Y" where X and Y are not ends of one scale ("from startups to sustainability", "from the ledger to the report"). A real range has an order or a measure: "from 5 to 50 ms", "from draft to approved".
  - Fix: list the items, or name what they have in common.

*Style*

- Em dashes (script: yes, also en dashes and " -- ").
  - Detect: every "—", "–" used as a clause break, and " -- ". Count them.
  - Fix: period, comma, colon, or parentheses. Target zero. Keep a numeric range en dash only inside a verbatim quote or code.
- Colon overuse (script: no).
  - Detect: a colon in the middle of a sentence joining two clauses ("The result was clear: it failed"). A colon before a list, a definition, a code example, or a label is fine.
  - Fix: split into two sentences or use "because", "so", or a comma.
- Bold overuse (script: partial).
  - Detect: bold on proper nouns, product names, acronyms, whole phrases for emphasis, or on more than one or two spans per screen. Bold labels at the start of list items.
  - Fix: remove the bold. Keep it only for UI labels the reader must find, and warnings that must not be missed.
- Inline-header lists (script: yes).
  - Detect: list items shaped `- **Label:** text` or `- **Label** - text` where the text restates the label.
  - Fix: write prose, with an italic lead-in if a label helps: `*Schema in C#.* All tables live in one file.` Keep a label only when items are genuinely a lookup (then use a table).
- Title case headings (script: partial).
  - Detect: headings where most words are capitalized ("Getting Started With The API").
  - Fix: sentence case ("Getting started with the API"). Keep proper nouns, acronyms, and the project name.
- Decorative emojis (script: yes).
  - Detect: emoji in headings, bullets, or sentence ends (rocket, sparkles, check mark, warning sign, light bulb).
  - Fix: remove. Keep one only if it is part of quoted material or a required UI symbol.
- Curly quotes (script: yes).
  - Detect: any of the characters U+2018, U+2019, U+201C, U+201D around quotes or inside contractions.
  - Fix: straight `"` and `'`.

*Communication artifacts*

- Chatbot phrases (script: yes).
  - Detect: "I hope this helps", "Let me know if", "Feel free to", "Certainly!", "Absolutely!", "Of course!", "Here is a...", "I'd be happy to", "As an AI", "As of my last update", a closing offer of more help, or a recap of what you just said.
  - Fix: delete. Start with the content.
- Sycophantic tone (script: yes).
  - Detect: "Great question", "You're absolutely right", "That's a great idea", praise of the reader, unneeded apology ("I apologize for the confusion").
  - Fix: respond directly. If a correction is needed, state the correction.

*Filler*

- Filler phrases (script: yes).
  - Detect: "in order to", "due to the fact that", "the fact that", "at this point in time", "in the event that", "has the ability to", "is able to", "a large number of", "in close proximity to", "on a regular basis", "it is important to note that", "it is worth noting", "needless to say", "when it comes to", "basically", "essentially". Full list: `wordy` and `significance-filler` in `scripts/patterns.json`.
  - Fix: "to", "because", "now", "if", "can", "many", "near", "regularly"; delete the opener and state the point.
- Excessive hedging (script: yes).
  - Detect: stacked hedges ("could potentially", "might possibly", "it could be argued that", "may in some cases tend to"); hedging a fact that is known.
  - Fix: one hedge only, and only for real uncertainty. Prefer "may". State known things flatly.
- Generic conclusions (script: yes).
  - Detect: closing lines that summarize or look ahead without content: "The future looks bright", "In conclusion", "In summary", "Overall", "Moving forward", "Only time will tell", "continues to evolve".
  - Fix: replace with a specific next step, date, owner, or fact. Delete if nothing specific exists.

*Jargon*

- Abstract metaphor nouns (script: yes).
  - Detect: nouns used as figures: "substrate", "wedge" or "wedge in", "vector", "locus", "lens", "north star", "bedrock", "linchpin", "ecosystem", "paradigm", "surface area", "touchpoint", "tapestry", "crucible", "fulcrum". Full list: `abstract-metaphor` in `scripts/patterns.json`.
  - Fix: the literal word: substrate to "base", wedge in to "add", vector to "way" or "method", locus to "place", lens to "view". Keep the word when used literally.

*Plain speech*

- Feeling instead of function (script: no).
  - Detect: sentences about how something feels or impresses ("a powerful, elegant solution", "delivers a seamless experience").
  - Fix: say what it does and for whom: "Exports the ledger to CSV in one step."
- Dense sentences (script: no).
  - Detect: over about 25 words, three or more clauses, or two ideas joined by "and", "while", or a semicolon.
  - Fix: split into one idea per sentence.
- Passive voice (script: partial).
  - Detect: "is/was/are/were/been + past participle (+ by)" where the actor matters ("The report is generated by the service").
  - Fix: active voice with the actor as subject ("The service generates the report"). Passive is fine when the actor is unknown or irrelevant.
- Adverbs (script: partial).
  - Detect: "-ly" words and intensifiers: "very", "really", "quickly", "efficiently", "seamlessly", "simply", "just", "actually".
  - Fix: cut, or use a stronger verb or adjective ("runs quickly" to "is fast").
- Plain word over the fancy one (script: yes).
  - Detect: "utilize", "leverage", "facilitate", "commence", "endeavor", "ascertain", "prior to", "subsequent to", "in lieu of", "pertaining to", "methodology", "synergy".
  - Fix: "use", "help", "start", "try", "find out", "before", "after", "instead of", "about", "method".
- Mannered prose (script: no).
  - Detect: metaphor, flourish, or scene-setting where a literal phrase exists ("a symphony of services", "the beating heart of the system", "unlocks the power of").
  - Fix: the literal statement ("The services share one queue.").
- Over-compression (script: partial, symbols only).
  - Detect: dropped articles and verbs ("Parser reads file, outputs tree"), verbless fragments, `->`, `=>`, `&`, `+`, `w/`, `vs`, and abbreviations or private shorthand the reader must decode.
  - Fix: full sentences with articles and verbs; spell out the first use of an abbreviation. Do not overcorrect into the tells above.

### Step 4: Verify

Re-run the scan when the script path was used. In every case, re-read the result against the original and the catalog: every fact, number, name, and instruction is preserved, intentional leftovers are listed with a reason, and no new tell was introduced. A clean script run alone is not verification, because the script cannot see "script: no" patterns.

## Outputs

- Edited files, or for text with no file, the rewritten text returned in chat. Add a one-line summary of what changed and any findings left in place with the reason.

## Edge Cases

- *Quoted or verbatim text* (user quotes, error output, legal text) stays unchanged.
- *Code, commands, identifiers, and frontmatter* are never edited; the scan skips them, and the manual path must too.
- *A flagged word that is correct in context* ("additionally" in a real contrast, "landscape" as a page orientation, "bold" as a UI term) stays; say so.
- *Dense reference tables* are not expanded into prose; apply only the word-level rules.
- *A rewrite that would change meaning* is left alone and flagged for the author.
- *Required template sections* (PR template headings) keep their structure; clean only the content.
- *No findings* means say so in one line; do not rewrite text for its own sake.
