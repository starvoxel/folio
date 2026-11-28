// ------------------------------
// copy-categories.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  applyCommand,
  COMMAND_KIND,
  createBudget,
  encodeFolio,
  fixedClock,
  id,
  instantiateTemplate,
  localDate,
  type BudgetModel,
  type Command,
} from '@folio/core';
import type { FileStore } from '@folio/host-api';
import { copyCategoriesFromFile } from '../../packages/renderer/src/session/copy-from-file.js';
import { webDigest } from '../../packages/renderer/src/session/web-digest.js';
import { createFileHost } from '../../apps/desktop/src/main/file-host.js';
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

const clock = fixedClock(localDate('2026-11-28'));
const context = { lockedMonths: [], accountHasTransactions: () => false };
let root = '';
let counter = 0;

/**
 * @returns A source of distinct UUIDs.
 */
function ids(): () => string {
  return () => `dddddddd-0000-4000-8000-${String((counter += 1)).padStart(12, '0')}`;
}

/**
 * @param model - A model.
 * @param command - A command that must succeed.
 * @returns The new model.
 */
function run(model: BudgetModel, command: Command): BudgetModel {
  const result = applyCommand(model, command, context);
  if (!result.ok) {
    throw new Error('Refused');
  }
  return result.value.model;
}

/**
 * @param path - The only file the person has chosen.
 * @returns A file store on the real disk that can read that file.
 */
function storeFor(path: string): Pick<FileStore, 'open'> {
  const grants = createPathGrants();
  grants.grant(path);
  const host = createFileHost({
    fs: nodeFsOps,
    grants,
    logger: quiet,
    backupRoot: join(root, 'backups'),
    self: { instance: 'a', host: 'TEST-PC', pid: process.pid, takenMs: 0 },
    nowMs: () => Date.now(),
    isProcessAlive: (pid) => pid === process.pid,
    uniqueId: () => `t${String((counter += 1))}`,
    hashOf: () => 'file',
  });
  return { open: (file) => host.readFile(file) };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'folio-copy-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('copyCategoriesFromFile', () => {
  describe('twoRealFiles', () => {
    it('copiesOnlyTheCategoriesIntoTheNewBudget', async () => {
      let source = createBudget('Source', clock);
      source = run(source, {
        kind: COMMAND_KIND.applyTemplate,
        categories: instantiateTemplate('detailed', ids()),
      });
      source = run(source, {
        kind: COMMAND_KIND.addAccount,
        id: id<'Account'>('aaaaaaaa-0000-4000-8000-000000000001'),
        name: 'Everyday',
        type: 'chequing',
      });
      const path = join(root, 'Source.folio');
      await writeFile(path, await encodeFolio(source, { digest: webDigest }));

      const copied = await copyCategoriesFromFile(
        storeFor(path),
        { path, name: 'Source.folio' },
        { digest: webDigest, ids: ids() },
      );
      expect(copied.ok).toBe(true);
      const target = copied.ok
        ? run(createBudget('Target', clock), {
            kind: COMMAND_KIND.applyTemplate,
            categories: copied.value,
          })
        : createBudget('Target', clock);
      expect(target.categories.map((category) => category.name)).toEqual(
        source.categories.map((category) => category.name),
      );
      expect(target.accounts).toEqual([]);
    });
  });

  describe('aDamagedFileOnDisk', () => {
    it('failsAndLeavesTheTargetUntouched', async () => {
      const path = join(root, 'Broken.folio');
      await writeFile(path, 'not a folio file');
      const failed = await copyCategoriesFromFile(
        storeFor(path),
        { path, name: 'Broken.folio' },
        { digest: webDigest, ids: ids() },
      );
      expect(failed).toEqual({
        ok: false,
        error: { kind: 'invalidFile', failure: { code: 'notAZip' } },
      });
    });
  });
});
