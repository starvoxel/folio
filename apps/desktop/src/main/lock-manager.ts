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
  /** Called when a stale lock was replaced, so the host can log it. */
  readonly onStaleTakenOver?: () => void;
}

/** Takes and releases the sidecar locks of budget files (AD-12). */
export interface LockManager {
  acquire(file: string, options?: LockOptions): Promise<LockResult>;
  /** Release the lock of a file, but only if this app holds it. */
  release(file: string): Promise<void>;
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

  const acquire = async (file: string, options?: LockOptions): Promise<LockResult> => {
    const lockPath = lockPathFor(file);
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const taken = { ...deps.self, takenMs: deps.nowMs() };
      if (await deps.fs.createExclusive(lockPath, serializeLock(taken))) {
        heldFiles.add(file);
        return { kind: 'acquired' };
      }
      const verdict = judgeLock({
        existing: await deps.fs.readText(lockPath),
        self: deps.self,
        nowMs: deps.nowMs(),
        isProcessAlive: deps.isProcessAlive,
      });
      if (verdict.kind === 'own') {
        heldFiles.add(file);
        return { kind: 'acquired' };
      }
      if (verdict.kind === 'held') {
        if (!(verdict.stale && options?.takeOverStale === true)) {
          return { kind: 'held', holder: verdict.holder, stale: verdict.stale };
        }
        await deps.fs.remove(lockPath);
        deps.onStaleTakenOver?.();
      }
    }
    // Another app keeps winning the race; report what is there now.
    const existing = await deps.fs.readText(lockPath);
    const holder = existing === null ? null : parseLock(existing);
    return { kind: 'held', holder: holder?.host ?? 'unknown', stale: false };
  };

  const release = async (file: string): Promise<void> => {
    const lockPath = lockPathFor(file);
    const existing = await deps.fs.readText(lockPath);
    const holder = existing === null ? null : parseLock(existing);
    if (holder?.instance === deps.self.instance) {
      await deps.fs.remove(lockPath);
    }
    heldFiles.delete(file);
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
