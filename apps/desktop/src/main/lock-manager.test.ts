// ------------------------------
// lock-manager.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { serializeLock, type LockInfo } from './lock-file.js';
import { createLockManager } from './lock-manager.js';
import { createMemoryFs } from './memory-fs.js';

const self: LockInfo = { instance: 'me', host: 'KITCHEN-PC', pid: 10, takenMs: 0 };
const folder = resolve('/data');
const file = join(folder, 'Household.folio');
const lockPath = `${file}.lock`;

/**
 * @param alive - The pids that count as running.
 * @returns A fresh file system and a manager on it.
 */
function setup(alive: readonly number[] = [10]) {
  const fs = createMemoryFs();
  let takeOvers = 0;
  const manager = createLockManager({
    fs,
    self,
    nowMs: () => 5000,
    isProcessAlive: (pid) => alive.includes(pid),
    onStaleTakenOver: () => {
      takeOvers += 1;
    },
  });
  return { fs, manager, takeOvers: () => takeOvers };
}

describe('lockManagerAcquire', () => {
  describe('freeFile', () => {
    it('writesTheLockAndRemembersIt', async () => {
      const { fs, manager } = setup();
      expect(await manager.acquire(file)).toEqual({ kind: 'acquired' });
      expect(fs.files.has(lockPath)).toBe(true);
      expect(manager.held()).toEqual([file]);
    });
  });

  describe('lockAlreadyOurs', () => {
    it('isAcquiredAgain', async () => {
      const { manager } = setup();
      await manager.acquire(file);
      expect(await manager.acquire(file)).toEqual({ kind: 'acquired' });
    });
  });

  describe('lockOfARunningOtherApp', () => {
    it('isHeldAndNotTaken', async () => {
      const { fs, manager } = setup([10, 20]);
      fs.touch(
        lockPath,
        new TextEncoder().encode(serializeLock({ ...self, instance: 'x', pid: 20 })),
      );
      expect(await manager.acquire(file, { takeOverStale: true })).toEqual({
        kind: 'held',
        holder: 'KITCHEN-PC',
        stale: false,
      });
    });
  });

  describe('staleLockWithoutTakeOver', () => {
    it('isReportedAndLeftInPlace', async () => {
      const { fs, manager, takeOvers } = setup();
      fs.touch(
        lockPath,
        new TextEncoder().encode(serializeLock({ ...self, instance: 'x', pid: 99 })),
      );
      expect(await manager.acquire(file)).toEqual({
        kind: 'held',
        holder: 'KITCHEN-PC',
        stale: true,
      });
      expect(fs.files.has(lockPath)).toBe(true);
      expect(takeOvers()).toBe(0);
    });
  });

  describe('staleLockWithTakeOver', () => {
    it('isReplacedAndCounted', async () => {
      const { fs, manager, takeOvers } = setup();
      fs.touch(
        lockPath,
        new TextEncoder().encode(serializeLock({ ...self, instance: 'x', pid: 99 })),
      );
      expect(await manager.acquire(file, { takeOverStale: true })).toEqual({ kind: 'acquired' });
      expect(takeOvers()).toBe(1);
    });
  });
});

describe('lockManagerRelease', () => {
  describe('aLockWeHold', () => {
    it('deletesTheLockFile', async () => {
      const { fs, manager } = setup();
      await manager.acquire(file);
      await manager.release(file);
      expect(fs.files.has(lockPath)).toBe(false);
      expect(manager.held()).toEqual([]);
    });
  });

  describe('aLockSomeoneElseHolds', () => {
    it('leavesTheFile', async () => {
      const { fs, manager } = setup();
      fs.touch(
        lockPath,
        new TextEncoder().encode(serializeLock({ ...self, instance: 'x', pid: 20 })),
      );
      await manager.release(file);
      expect(fs.files.has(lockPath)).toBe(true);
    });
  });

  describe('releaseAll', () => {
    it('releasesEveryHeldLock', async () => {
      const { fs, manager } = setup();
      await manager.acquire(file);
      await manager.acquire(join(folder, 'Other.folio'));
      await manager.releaseAll();
      expect([...fs.files.keys()]).toEqual([]);
    });
  });
});
