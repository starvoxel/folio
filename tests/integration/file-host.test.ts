// ------------------------------
// file-host.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFileHost, type FileHost } from '../../apps/desktop/src/main/file-host.js';
import type { FsOps } from '../../apps/desktop/src/main/fs-ops.js';
import { serializeLock } from '../../apps/desktop/src/main/lock-file.js';
import type { Logger } from '../../apps/desktop/src/main/logger.js';
import { nodeFsOps } from '../../apps/desktop/src/main/node-fs-ops.js';
import { createPathGrants } from '../../apps/desktop/src/main/path-grants.js';

const quiet: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  logError: () => undefined,
};

let root = '';
let budget = { path: '', name: 'Household.folio' };
let counter = 0;

/**
 * @param instance - A name for this running app, so two can be told apart in one test.
 * @param fs - The file system to use, which a test may wrap to inject a fault.
 * @returns A file host over the real disk with the budget file granted.
 */
function makeHost(instance: string, fs: FsOps = nodeFsOps): FileHost {
  const grants = createPathGrants();
  grants.grant(budget.path);
  return createFileHost({
    fs,
    grants,
    logger: quiet,
    backupRoot: join(root, 'backups'),
    self: { instance, host: 'TEST-PC', pid: process.pid, takenMs: 0 },
    nowMs: () => Date.now(),
    isProcessAlive: (pid) => pid === process.pid,
    uniqueId: () => `t${String((counter += 1))}`,
    hashOf: () => 'file',
  });
}

const text = (value: string): Uint8Array => new TextEncoder().encode(value);
const readText = async (path: string): Promise<string> => readFile(path, 'utf8');

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'folio-host-'));
  budget = { path: join(root, 'Household.folio'), name: 'Household.folio' };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('atomicSave', () => {
  describe('aSimulatedCrashBetweenWriteAndRename', () => {
    it('leavesTheOldFileWholeAndALaterSaveStillWorks', async () => {
      await writeFile(budget.path, 'old contents');
      const crashing: FsOps = {
        ...nodeFsOps,
        rename: () => Promise.reject(new Error('the process died')),
        // A real crash cleans nothing up, so the leftover temporary file stays.
        remove: () => Promise.resolve(),
      };
      await expect(
        makeHost('a', crashing).writeFileAtomic(budget, text('new contents'), null),
      ).rejects.toThrow('the process died');
      expect(await readText(budget.path)).toBe('old contents');
      expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toHaveLength(1);

      const result = await makeHost('b').writeFileAtomic(budget, text('newer contents'), null);
      expect(result.kind).toBe('saved');
      expect(await readText(budget.path)).toBe('newer contents');
    });
  });

  describe('aCrashWhileWritingTheTemporaryFile', () => {
    it('neverTouchesTheTarget', async () => {
      await writeFile(budget.path, 'old contents');
      const crashing: FsOps = {
        ...nodeFsOps,
        writeFileSynced: async (path) => {
          await writeFile(path, 'half');
          throw new Error('the process died');
        },
        remove: () => Promise.resolve(),
      };
      await expect(
        makeHost('a', crashing).writeFileAtomic(budget, text('new contents'), null),
      ).rejects.toThrow('the process died');
      expect(await readText(budget.path)).toBe('old contents');
    });
  });

  describe('aNormalSave', () => {
    it('replacesTheFileLeavesNoTemporaryFileAndReturnsTheDiskStamp', async () => {
      const host = makeHost('a');
      await writeFile(budget.path, 'one');
      const { stamp } = await host.readFile(budget);
      const result = await host.writeFileAtomic(budget, text('two!'), stamp);
      expect(result.kind).toBe('saved');
      expect(await readText(budget.path)).toBe('two!');
      expect(await readdir(root)).toEqual(['Household.folio']);
      if (result.kind === 'saved') {
        expect((await host.readFile(budget)).stamp).toEqual(result.stamp);
      }
    });
  });

  describe('theFileChangedOnDiskSinceItWasRead', () => {
    it('refusesAndKeepsTheOtherVersion', async () => {
      const host = makeHost('a');
      await writeFile(budget.path, 'one');
      const { stamp } = await host.readFile(budget);
      await writeFile(budget.path, 'changed by a sync client');
      const result = await host.writeFileAtomic(budget, text('mine'), stamp);
      expect(result.kind).toBe('changedOnDisk');
      expect(await readText(budget.path)).toBe('changed by a sync client');
    });
  });
});

describe('sidecarLock', () => {
  describe('twoRunningApps', () => {
    it('secondSeesTheFirstAsHeldAndNotStaleUntilItReleases', async () => {
      const first = makeHost('first');
      const second = makeHost('second');
      expect(await first.acquireLock(budget)).toEqual({ kind: 'acquired' });
      expect(await second.acquireLock(budget)).toEqual({
        kind: 'held',
        holder: 'TEST-PC',
        stale: false,
      });
      await first.releaseLock(budget);
      expect(await second.acquireLock(budget)).toEqual({ kind: 'acquired' });
      await second.releaseAllLocks();
      expect(await readdir(root)).toEqual([]);
    });
  });

  describe('aLockLeftByAProcessThatDied', () => {
    it('isReportedStaleAndReplacedOnlyWhenAsked', async () => {
      const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
      const deadPid = child.pid ?? 0;
      await once(child, 'exit');
      const lock = serializeLock({ instance: 'gone', host: 'TEST-PC', pid: deadPid, takenMs: 0 });
      await writeFile(`${budget.path}.lock`, lock);
      // This host's liveness check is the real one for the dead pid.
      const host = createFileHost({
        fs: nodeFsOps,
        grants: (() => {
          const grants = createPathGrants();
          grants.grant(budget.path);
          return grants;
        })(),
        logger: quiet,
        backupRoot: join(root, 'backups'),
        self: { instance: 'me', host: 'TEST-PC', pid: process.pid, takenMs: 0 },
        nowMs: () => Date.now(),
        isProcessAlive: (pid) => {
          try {
            process.kill(pid, 0);
            return true;
          } catch {
            return false;
          }
        },
        uniqueId: () => 'x',
        hashOf: () => 'file',
      });
      expect(await host.acquireLock(budget)).toEqual({
        kind: 'held',
        holder: 'TEST-PC',
        stale: true,
      });
      expect(await host.acquireLock(budget, { takeOverStale: true })).toEqual({
        kind: 'acquired',
      });
    });
  });
});

describe('backups', () => {
  describe('moreBackupsThanAreKeptInOneSecond', () => {
    it('keepsTheNewestTenInsideTheBackupRootAndNothingBesideTheFile', async () => {
      const host = makeHost('a');
      for (let index = 0; index < 12; index += 1) {
        await host.backUp(budget, text(`version ${String(index)}`));
      }
      const folder = join(root, 'backups', 'file');
      const kept = await Promise.all(
        (await readdir(folder)).map(async (name) => readText(join(folder, name))),
      );
      expect(kept.sort()).toEqual(
        Array.from({ length: 10 }, (_, index) => `version ${String(index + 2)}`).sort(),
      );
      expect(kept).toContain('version 11');
      expect(await readdir(root)).toEqual(['backups']);
    });
  });
});

describe('pathsThePersonDidNotChoose', () => {
  describe('everyOperation', () => {
    it('isRefusedAndTouchesNothing', async () => {
      const host = makeHost('a');
      const other = { path: join(root, 'other.folio'), name: 'other.folio' };
      await expect(host.writeFileAtomic(other, text('x'), null)).rejects.toMatchObject({
        code: 'permissionDenied',
      });
      await expect(host.readFile(other)).rejects.toMatchObject({ code: 'permissionDenied' });
      expect(await readdir(root)).toEqual([]);
    });
  });
});
