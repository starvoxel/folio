// ------------------------------
// log-message-mask.ts
//
// Author: Starvoxel AI Agent - 2026-11-21
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { LOG_VOCABULARY, POSITION_WORDS } from './log-vocabulary.js';

/** What replaces a hidden word, number or quoted text. */
export const MASK = '<?>';
// Longer input is cut before it is looked at, so a huge message cannot make the masker slow.
const MAX_INPUT_LENGTH = 1000;
const OPENING_QUOTES: Readonly<Record<string, string>> = {
  '"': '"',
  "'": "'",
  '`': '`',
  '“': '”',
  '‘': '’',
  '«': '»',
};
const TOKEN = /[\p{L}\p{M}]+|\p{N}+|[^\p{L}\p{M}\p{N}]+/gu;
// Between a number and the word before it, only spaces and a colon or equals sign are allowed
// (`position 15`, `line: 4`).
const NUMBER_LEAD = /^\s*[:=]?\s*$/u;
// Hidden words that sit next to each other, with only separators between them, become one mask.
const ADJACENT_MASKS = /<\?>(?:[\s,.:;/\\@#_&+-]*<\?>)+/gu;
// What can follow an apostrophe inside a word (`can't`, `it's`, `we've`).
const CONTRACTION_SUFFIXES: ReadonlySet<string> = new Set(['t', 's', 're', 'll', 've', 'd', 'm']);
const CONTROL = /[\p{Cc}\p{Cf}]+/gu;

/**
 * Hide everything between a pair of quotes. A quote that is never closed hides the rest of the
 * message, because the text after it may be the quoted value.
 * @param text - The message.
 * @returns The message with each quoted span replaced by the mask.
 */
function maskQuotes(text: string): string {
  let result = '';
  let index = 0;
  while (index < text.length) {
    const char = text.charAt(index);
    const closing = OPENING_QUOTES[char];
    // An apostrophe inside a word (`can't`) does not open a quote.
    const inWord =
      (char === "'" || char === '’') &&
      /\p{L}/u.test(text.charAt(index - 1)) &&
      /\p{L}/u.test(text.charAt(index + 1));
    if (closing === undefined || inWord) {
      result += char;
      index += 1;
      continue;
    }
    const end = text.indexOf(closing, index + 1);
    result += end === -1 ? `${char}${MASK}` : `${char}${MASK}${closing}`;
    index = end === -1 ? text.length : end + 1;
  }
  return result;
}

/** A masked message and the words the mask hid, for the development-only unredacted output. */
export interface MaskReport {
  /** The masked message, as `maskMessage` returns it. */
  readonly masked: string;
  /** The distinct words that were hidden because they are not in the vocabulary, lower case. */
  readonly hiddenWords: readonly string[];
}

/**
 * Make the message of an error the app did not raise safe to log. Library messages quote values
 * (a parse error quotes the text it choked on), so nothing is trusted: quoted text is hidden, a
 * word is kept only if it is in `LOG_VOCABULARY`, and a number is kept only straight after a word
 * such as `position` or `line`. Everything else becomes `<?>`, and neighbouring masks merge, so
 * even the number of hidden words is not shown. The result is one line.
 *
 * The check is a whitelist, so it fails closed: a word nobody thought of is hidden.
 * @param message - The error's message.
 * @returns The masked message.
 */
export function maskMessage(message: string): string {
  return maskMessageWithReport(message).masked;
}

/**
 * Mask a message like `maskMessage` and also report which words were hidden, so the word list can
 * be grown from real use. Words inside quoted text are not reported: they were hidden as a whole
 * and are the data the mask exists to hide.
 * @param message - The error's message.
 * @returns The masked message and the hidden words.
 */
export function maskMessageWithReport(message: string): MaskReport {
  const hidden = new Set<string>();
  const text = maskQuotes(message.slice(0, MAX_INPUT_LENGTH).replace(CONTROL, ' '));
  let result = '';
  // The last word that was kept, and what has come after it, to decide about a number.
  let lastWord = '';
  let gap = '';
  // The previous token, to tell `can't` (a word, an apostrophe, a suffix) from a quote.
  let previous = '';
  let beforePrevious = '';
  for (const token of text.match(TOKEN) ?? []) {
    if (/^[\p{L}\p{M}]/u.test(token)) {
      const lower = token.toLowerCase();
      const afterApostrophe =
        (previous === "'" || previous === '\u2019') && /^[\p{L}\p{M}]/u.test(beforePrevious);
      const kept =
        LOG_VOCABULARY.has(lower) || (afterApostrophe && CONTRACTION_SUFFIXES.has(lower));
      result += kept ? token : MASK;
      if (!kept) {
        hidden.add(lower);
      }
      lastWord = kept ? lower : '';
      gap = '';
    } else if (/^\p{N}/u.test(token)) {
      const kept = POSITION_WORDS.has(lastWord) && NUMBER_LEAD.test(gap);
      // A sign in front of a hidden number would show whether the number was negative.
      result = kept ? result : result.replace(/[-+]$/u, '');
      result += kept ? token : MASK;
      lastWord = '';
      gap = '';
    } else {
      result += token;
      gap += token;
    }
    beforePrevious = previous;
    previous = token;
  }
  return { masked: result.replace(ADJACENT_MASKS, MASK).trim(), hiddenWords: [...hidden] };
}
