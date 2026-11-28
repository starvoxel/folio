// ------------------------------
// file-session.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fixedClock, localDate, type BudgetModel } from '@folio/core';
import type { FileRef, FileStore } from '@folio/host-api';
import { webDigest } from '../../packages/renderer/src/session/web-digest.js';
import {
  createFileSession,
  type FileSession,
} from '../../packages/renderer/src/session/file-session.js';
import { createFileHost, type FileHost } from '../../apps/desktop/src/main/file-host.js';
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
let location: FileRef = { path: '', name: 'Household 2027.folio' };
let counter = 0;

/**
 * Make a running app: the real file host on the real disk and a session over it, with the save
 * dialog answered with the test's location.
 * @param instance - A name for this running app, so two can be told apart.
 * @returns The session.
 */
function makeApp(instance: string): FileSession {
  const grants = createPathGrants();
  grants.grant(location.path);
  const host: FileHost = createFileHost({
    fs: nodeFsOps,
    grants,
    logger: quiet,
    backupRoot: join(root, 'backups'),
    self: { instance, host: 'TEST-PC', pid: process.pid, takenMs: 0 },
    nowMs: () => Date.now(),
    isProcessAlive: (pid) => pid === process.pid,
    uniqueId: () => `t${String((counter += 1))}`,
    hashOf: () => 'file',
  });
  const store: FileStore = {
    open: (file) => host.readFile(file),
    save: (file, bytes, expected) => host.writeFileAtomic(file, bytes, expected),
    lock: (file, options) => host.acquireLock(file, options),
    unlock: (file) => host.releaseLock(file),
    backUp: (file, bytes) => host.backUp(file, bytes),
    latestBackup: (file) => host.latestBackup(file),
  };
  return createFileSession({
    store,
    digest: webDigest,
    clock: fixedClock(localDate('2026-11-28')),
    appVersion: '0.0.0-test',
    chooseSaveLocation: () => Promise.resolve(location),
    report: () => undefined,
  });
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'folio-session-'));
  location = { path: join(root, 'Household 2027.folio'), name: 'Household 2027.folio' };
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('FileSession on a real folder', () => {
  describe('aNewFile', () => {
    it('existsOnDiskAndOpensAtOnceWithNoAccountsAndTheCurrentMonth', async () => {
      const writer = makeApp('a');
      const created = await writer.create('Household 2027');
      expect(created.ok).toBe(true);
      await writer.close();

      const reader = makeApp('b');
      const opened = await reader.open(location);
      expect(opened.ok && opened.value.model.accounts).toEqual([]);
      expect(opened.ok && opened.value.model.settings.createdOn.slice(0, 7)).toBe('2026-11');
    });
  });

  describe('aFileWithAFlippedByte', () => {
    it('showsTheCorruptFileErrorAndOpensTheBackupInstead', async () => {
      const first = makeApp('a');
      await first.create('Household 2027');
      await first.close();
      const good = await readFile(location.path);
      const damaged = Buffer.from(good);
      const middle = Math.floor(damaged.length / 2);
      damaged[middle] = (damaged[middle] ?? 0) ^ 0xff;
      await writeFile(location.path, damaged);

      const app = makeApp('b');
      const failed = await app.open(location);
      expect(!failed.ok && failed.error.kind).toBe('invalidFile');
      const backup = !failed.ok && failed.error.kind === 'invalidFile' ? failed.error.backup : null;
      expect(backup).not.toBeNull();

      const recovered = await app.openBackup(location, backup ?? location);
      expect(recovered.ok).toBe(true);
      const saved = recovered.ok ? await app.save(recovered.value.model) : null;
      expect(saved?.ok).toBe(true);
      await app.close();
      const reopened = await makeApp('c').open(location);
      expect(reopened.ok).toBe(true);
    });
  });

  describe('aFileOpenInAnotherApp', () => {
    it('showsTheInUseWarningUntilTheHolderCloses', async () => {
      const holder = makeApp('a');
      await holder.create('Household 2027');
      const second = makeApp('b');
      const refused = await second.open(location);
      expect(!refused.ok && refused.error).toMatchObject({ kind: 'locked', stale: false });
      await holder.close();
      expect((await second.open(location)).ok).toBe(true);
    });
  });

  describe('aFileChangedOnDiskSinceItWasRead', () => {
    it('refusesToSaveAndLeavesThatFileAlone', async () => {
      const app = makeApp('a');
      const created = await app.create('Household 2027');
      await writeFile(location.path, 'changed by another program');
      const result = await app.save(created.ok ? created.value.model : emptyOf());
      expect(result).toEqual({ ok: false, error: { kind: 'changedOnDisk' } });
      expect(await readFile(location.path, 'utf8')).toBe('changed by another program');
    });
  });

  describe('aFileDeletedSinceItWasRead', () => {
    it('refusesToSaveAndDoesNotRecreateIt', async () => {
      const app = makeApp('a');
      const created = await app.create('Household 2027');
      await unlink(location.path);
      const result = await app.save(created.ok ? created.value.model : emptyOf());
      expect(result).toEqual({ ok: false, error: { kind: 'fileGone' } });
    });
  });
});

/**
 * @returns A model to save where the test does not care about its content.
 */
function emptyOf(): BudgetModel {
  return {
    settings: { name: 'x', createdOn: localDate('2026-11-28'), setup: { completedSteps: [] } },
    accounts: [],
    categories: [],
  };
}
