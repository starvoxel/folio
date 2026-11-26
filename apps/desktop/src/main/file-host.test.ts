// ------------------------------
// file-host.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createFileHost } from './file-host.js';
import type { Logger } from './logger.js';
import { createMemoryFs } from './memory-fs.js';
import { createPathGrants } from './path-grants.js';

const chosen = { path: join(resolve('/data'), 'Household.folio'), name: 'Household.folio' };
const stranger = { path: join(resolve('/etc'), 'passwd'), name: 'passwd' };

const backupRoot = join(resolve('/app'), 'backups');

/**
 * @returns A host on an in-memory disk where `chosen` is the only granted file, and the log lines.
 */
function setup() {
  const fs = createMemoryFs();
  const lines: string[] = [];
  const note = (level: string) => (message: string, fields?: Record<string, unknown>) => {
    lines.push(`${level} ${message} ${JSON.stringify(fields ?? {})}`);
  };
  const logger: Logger = {
    debug: note('debug'),
    info: note('info'),
    warn: note('warn'),
    error: note('error'),
    logError: note('error'),
  };
  const grants = createPathGrants('linux');
  grants.grant(chosen.path);
  let id = 0;
  const host = createFileHost({
    fs,
    grants,
    logger,
    backupRoot,
    self: { instance: 'me', host: 'PC', pid: 1, takenMs: 0 },
    nowMs: () => Date.UTC(2026, 0, 1),
    isProcessAlive: () => true,
    uniqueId: () => `id${String((id += 1))}`,
    hashOf: () => 'hash',
  });
  return { fs, host, lines };
}

describe('createFileHost', () => {
  describe('aFileThePersonDidNotChoose', () => {
    it('isRefusedByEveryOperationWithoutLoggingThePath', async () => {
      const { host, lines } = setup();
      const calls = [
        host.readFile(stranger),
        host.writeFileAtomic(stranger, new Uint8Array([1]), null),
        host.acquireLock(stranger),
        host.releaseLock(stranger),
        host.backUp(stranger, new Uint8Array([1])),
      ];
      for (const call of calls) {
        await expect(call).rejects.toMatchObject({ code: 'permissionDenied' });
      }
      expect(lines).toHaveLength(5);
      expect(lines.every((line) => line.startsWith('warn') && !line.includes('passwd'))).toBe(true);
    });
  });

  describe('saveThenRead', () => {
    it('returnsWhatWasSavedAndLogsOnlyTheSize', async () => {
      const { host, lines } = setup();
      await host.writeFileAtomic(chosen, new Uint8Array([4, 5]), null);
      const read = await host.readFile(chosen);
      expect(read.bytes).toEqual(new Uint8Array([4, 5]));
      expect(lines).toEqual(['info saved a file {"bytes":2}']);
    });
  });

  describe('saveAfterAnotherProgramChangedTheFile', () => {
    it('refusesAndWarns', async () => {
      const { host, fs, lines } = setup();
      await host.writeFileAtomic(chosen, new Uint8Array([1]), null);
      const { stamp } = await host.readFile(chosen);
      fs.touch(chosen.path, new Uint8Array([9, 9]));
      const result = await host.writeFileAtomic(chosen, new Uint8Array([2]), stamp);
      expect(result.kind).toBe('changedOnDisk');
      expect(lines.at(-1)).toBe('warn refused to save: the file changed on disk {}');
    });
  });

  describe('lockThenRelease', () => {
    it('takesAndFreesTheSidecarLock', async () => {
      const { host, fs } = setup();
      expect(await host.acquireLock(chosen)).toEqual({ kind: 'acquired' });
      expect(fs.files.has(`${chosen.path}.lock`)).toBe(true);
      await host.releaseLock(chosen);
      expect(fs.files.has(`${chosen.path}.lock`)).toBe(false);
    });
  });

  describe('backUp', () => {
    it('writesUnderTheBackupRootInAFolderForThatFile', async () => {
      const { host, fs, lines } = setup();
      const backup = await host.backUp(chosen, new Uint8Array([3]));
      expect(backup.path).toBe(join(backupRoot, 'hash', 'Household-20260101T000000000Z.folio'));
      expect(fs.files.has(backup.path)).toBe(true);
      expect(lines.at(-1)).toBe('info wrote a backup {"bytes":1,"pruned":0}');
    });
  });
});
