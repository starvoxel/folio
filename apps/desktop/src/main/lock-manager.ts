// ------------------------------
// lock-manager.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { LockOptions, LockResult } from '@folio/host-api';

import type { FsOps } from './fs-ops.js';
import { judgeLock, lockPathFor, parseLock, serializeLock, type LockInfo } from './lock-file.js';

/** What the lock manager needs from the machine. */
export interface LockManagerDeps {
  readonly fs: FsOps;
  /** Who this running app is; written into every lock it takes. */
  readonly self: LockInfo;
  readonly nowMs: () => number;
  readonly isProcessAlive: (pid: number) => boolean;
  /** A short unique id, for the name a stale lock is moved to. */
  readonly uniqueId: () => string;
  /** Called when a stale lock was replaced, so the host can log it. */
  readonly onStaleTakenOver?: () => void;
}

/** Takes and releases the sidecar locks of budget files (AD-12). */
export interface LockManager {
  acquire(file: string, options?: LockOptions): Promise<LockResult>;
  /** Release the lock of a file, but only if this app holds it; true when it was released. */
  release(file: string): Promise<boolean>;
  /** Release every lock this app holds, for quitting. */
  releaseAll(): Promise<void>;
  /** The files this app holds locks for. */
  held(): readonly string[];
}

const MAX_ATTEMPTS = 3;

/**
 * Create the lock manager. A lock is a file created with "fail if it exists", which the file
 * system makes atomic, so two apps never both think they hold it.
 * @param deps - The file system, this app's identity, the clock and the process check.
 * @returns The manager.
 */
export function createLockManager(deps: LockManagerDeps): LockManager {
  const heldFiles = new Set<string>();

  /**
   * Remove a lock judged stale. It is moved aside first and checked: if another app replaced it
   * with a live lock in the meantime, that lock is put back instead of being destroyed. A third
   * app creating a lock in that instant can still win; the window is a few file-system calls.
   * @param lockPath - The lock file.
   * @param staleText - The text that was judged stale.
   */
  const clearStaleLock = async (lockPath: string, staleText: string): Promise<void> => {
    const aside = `${lockPath}.${deps.uniqueId()}.stale`;
    try {
      await deps.fs.rename(lockPath, aside);
    } catch {
      // The lock is already gone or moved: another app got there first; the next pass re-reads.
      return;
    }
    const moved = await deps.fs.readText(aside);
    await deps.fs.remove(aside);
    if (moved === staleText) {
      deps.onStaleTakenOver?.();
    } else if (moved !== null) {
      await deps.fs.createExclusive(lockPath, moved);
    }
  };

  const acquire = async (file: string, options?: LockOptions): Promise<LockResult> => {
    const lockPath = lockPathFor(file);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const taken = { ...deps.self, takenMs: deps.nowMs() };
      if (await deps.fs.createExclusive(lockPath, serializeLock(taken))) {
        heldFiles.add(file);
        return { kind: 'acquired' };
      }
      const staleText = await deps.fs.readText(lockPath);
      const verdict = judgeLock({
        existing: staleText,
        self: deps.self,
        nowMs: deps.nowMs(),
        isProcessAlive: deps.isProcessAlive,
      });
      if (verdict.kind === 'own') {
        heldFiles.add(file);
        return { kind: 'acquired' };
      }
      if (verdict.kind === 'held') {
        if (!(verdict.stale && options?.takeOverStale === true && staleText !== null)) {
          return { kind: 'held', holder: verdict.holder, stale: verdict.stale };
        }
        await clearStaleLock(lockPath, staleText);
      }
    }
    // Another app keeps winning the race; report what is there now.
    const existing = await deps.fs.readText(lockPath);
    const holder = existing === null ? null : parseLock(existing);
    return { kind: 'held', holder: holder?.host ?? 'unknown', stale: false };
  };

  const release = async (file: string): Promise<boolean> => {
    const lockPath = lockPathFor(file);
    const existing = await deps.fs.readText(lockPath);
    const holder = existing === null ? null : parseLock(existing);
    heldFiles.delete(file);
    if (holder?.instance === deps.self.instance) {
      await deps.fs.remove(lockPath);
      return true;
    }
    return false;
  };

  return {
    acquire,
    release,
    releaseAll: async () => {
      for (const file of [...heldFiles]) {
        await release(file).catch(() => undefined);
      }
    },
    held: () => [...heldFiles],
  };
}
