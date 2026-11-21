// ------------------------------
// log-vocabulary.ts
//
// Author: Starvoxel AI Agent - 2026-11-21
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// The words a third-party error message may keep when it is masked (`maskMessage`). Every other
// word is hidden, so this list is the whole of what such a message can reveal, and it is a review
// item: add a word only if it is a plain error word that cannot stand for an account, an amount or
// a business. Words that are mostly names (will, may, mark, grant, long, short, key), brands
// (apple, shell, target, delta) or finance terms (account, balance, amount, payment, bank) stay out
// on purpose.
//
// Each group is one string of lower case words, so a reviewer can read it as a sentence. The
// masker compares in lower case.
const GROUPS: readonly string[] = [
  // Small words that hold sentences together.
  'a an and any are as at be been but by can cannot could did do does done for from had has have if in into is it its like must no non not of off on only or out over that the then this to too under up was were when where which while with without',
  // What went wrong.
  'aborted access already bad broken busy cancelled changed closed conflict corrupt corrupted denied destroyed disabled duplicate empty end error errors exceeded exceeds exists expected failed failure found illegal incomplete incorrect invalid larger lock locked mismatch missing needed negative operation overflow permitted permission rejected refused required reset smaller supported timed timeout truncated unable unavailable unexpected unknown unsupported unterminated valid incompatible malformed quoted',
  // What it was doing.
  'accessing allocating assigning assignment calling closing connecting converting copying creating decoding deleting encoding evaluating executing extracting finding loading moving opening parsing reading renaming resolving saving setting starting unzipping validating writing calling called cloned convert converted create define defined destructure extensible assign find reduce',
  // What it was doing it to.
  'argument arguments array boolean buffer byte bytes character characters checksum class column constant constructor data date decimal directory entry file files format function header index input integer iterator json length limit line list map maximum memory minimum module name null number object offset open parameter position promise properties property range read resource response row schema set signature size stream string symbol token type undefined value variable version write zip archive allocation call code count digits double element encoded first handler initial instance iterable method prototype proxy received receiver stack style time uri url utf',
  // Where it was.
  'above after before below between bounds inside outside',
  // Counting and comparing.
  'all both each few many more most one other same some such two',
  // Node system error codes, as they appear in messages.
  'eacces eaddrinuse eagain ebadf ebusy econnrefused econnreset eexist eintr einval eio eisdir emfile enoent enomem enospc enotdir enotempty eperm epipe erofs etimedout exdev',
  // The words around a position, which are also the only words a number may follow.
  'position line column index offset row',
];

/** The words a masked message may keep, in lower case. */
export const LOG_VOCABULARY: ReadonlySet<string> = new Set(
  GROUPS.flatMap((group) => group.split(' ')),
);

/** The words after which a number is kept, because a number there is a position, not a value. */
export const POSITION_WORDS: ReadonlySet<string> = new Set([
  'position',
  'line',
  'column',
  'index',
  'offset',
  'row',
]);
