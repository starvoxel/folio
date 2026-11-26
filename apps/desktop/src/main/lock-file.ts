// ------------------------------
// lock-file.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The suffix of the sidecar lock beside a budget file (AD-12). */
export const LOCK_SUFFIX = '.lock';

/**
 * A lock left by another computer is called stale after this long, because nothing there can be
 * asked whether its process is alive. A day is longer than any one review session.
 */
export const OTHER_COMPUTER_STALE_MS = 24 * 60 * 60 * 1000;

/** Who holds a lock, as written in the lock file. */
export interface LockInfo {
  /** A random id of one running app, so a restart is not mistaken for the same holder. */
  readonly instance: string;
  /** The computer's name, shown to the person when the lock is not theirs. */
  readonly host: string;
  readonly pid: number;
  /** When the lock was taken, in milliseconds since the Unix epoch. */
  readonly takenMs: number;
}

/** What a lock file says about a file's availability. */
export type LockVerdict =
  | { readonly kind: 'free' }
  | { readonly kind: 'own' }
  | { readonly kind: 'held'; readonly holder: string; readonly stale: boolean };

/**
 * @param file - The budget file's path.
 * @returns The path of its sidecar lock.
 */
export function lockPathFor(file: string): string {
  return `${file}${LOCK_SUFFIX}`;
}

/**
 * @param info - The holder.
 * @returns The text written to the lock file.
 */
export function serializeLock(info: LockInfo): string {
  return `${JSON.stringify(info)}\n`;
}

/**
 * Read a lock file. Anything that is not a well-formed lock is null: a half-written file is
 * what a crash during creation leaves behind.
 * @param text - The file's text.
 * @returns The holder, or null when the text is not a lock.
 */
export function parseLock(text: string): LockInfo | null {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    const { instance, host, pid, takenMs } = value;
    if (
      typeof instance === 'string' &&
      typeof host === 'string' &&
      Number.isSafeInteger(pid) &&
      typeof takenMs === 'number' &&
      Number.isFinite(takenMs)
    ) {
      return { instance, host, pid: pid as number, takenMs };
    }
  } catch {
    // Not JSON: treated as not a lock below.
  }
  return null;
}

/** What `judgeLock` needs to know. */
export interface JudgeInput {
  /** The lock file's text, or null when there is no file. */
  readonly existing: string | null;
  readonly self: LockInfo;
  readonly nowMs: number;
  /** Tells whether a process on this computer is still running. */
  readonly isProcessAlive: (pid: number) => boolean;
}

/**
 * Decide what an existing lock file means. On this computer a lock is stale once its process is
 * gone; for another computer it is stale only after a day.
 * @param input - The file's text, who is asking, the time and the process check.
 * @returns Free, ours, or held by someone with whether it is stale.
 */
export function judgeLock(input: JudgeInput): LockVerdict {
  if (input.existing === null) {
    return { kind: 'free' };
  }
  const held = parseLock(input.existing);
  if (held === null) {
    return { kind: 'held', holder: 'unknown', stale: true };
  }
  if (held.instance === input.self.instance) {
    return { kind: 'own' };
  }
  const stale =
    held.host === input.self.host
      ? !input.isProcessAlive(held.pid)
      : input.nowMs - held.takenMs > OTHER_COMPUTER_STALE_MS;
  return { kind: 'held', holder: held.host, stale };
}
