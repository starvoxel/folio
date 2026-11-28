// ------------------------------
// file-session.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  applyCommand,
  COMMAND_KIND,
  createBudget,
  fixedClock,
  id,
  localDate,
  type BudgetModel,
  type Result,
} from '@folio/core';
import { createHostFileStore, createMockHost, type FileRef, type FileStore } from '@folio/host-api';

import { createFileSession, type OpenedFile } from './file-session.js';
import { webDigest } from './web-digest.js';

const where: FileRef = { path: '/data/Household 2027.folio', name: 'Household 2027.folio' };
const other: FileRef = { path: '/data/Other.folio', name: 'Other.folio' };
const clock = fixedClock(localDate('2026-11-28'));
const emptyModel = createBudget('x', clock);

/**
 * @param files - Files that exist from the start.
 * @returns A session on a mock host, and the host.
 */
function setup(files: Record<string, Uint8Array> = {}, override: Partial<FileStore> = {}) {
  const host = createMockHost({ files });
  const suggestions: string[] = [];
  const session = createFileSession({
    store: { ...createHostFileStore(host), ...override },
    digest: webDigest,
    clock,
    appVersion: '0.0.0-test',
    chooseSaveLocation: (suggested) => {
      suggestions.push(suggested);
      return host.showSaveDialog({ suggestedName: suggested });
    },
    report: (event) => void host.logFileEvent(event),
  });
  return { host, session, suggestions };
}

/**
 * @param model - A model.
 * @returns The model with one account added.
 */
function withAccount(model: BudgetModel): BudgetModel {
  const result = applyCommand(
    model,
    {
      kind: COMMAND_KIND.addAccount,
      id: id<'Account'>('aaaaaaaa-0000-4000-8000-000000000001'),
      name: 'Everyday',
      type: 'chequing',
    },
    { lockedMonths: [], accountHasTransactions: () => false },
  );
  if (!result.ok) {
    throw new Error('Refused');
  }
  return result.value.model;
}

/**
 * @param result - The result of an open or a create.
 * @returns The model; the test fails if it did not succeed.
 */
function modelOf(result: Result<OpenedFile, unknown>): BudgetModel {
  if (!result.ok) {
    throw new Error('Expected the file to open');
  }
  return result.value.model;
}

/**
 * @param host - The host.
 * @param file - A file.
 * @returns The file's bytes.
 */
function bytesOf(host: ReturnType<typeof createMockHost>, file: FileRef): Uint8Array {
  const bytes = host.controls.fileBytes(file.path);
  if (bytes === undefined) {
    throw new Error('No such file');
  }
  return bytes;
}

describe('FileSession.create', () => {
  describe('aChosenLocation', () => {
    it('writesAnEmptyBudgetLocksItAndBacksItUp', async () => {
      const { host, session } = setup();
      host.controls.queueSaveDialog(where);
      const created = await session.create('Household 2027');
      expect(created.ok && created.value.model.accounts).toEqual([]);
      expect(created.ok && created.value.model.settings.createdOn).toBe('2026-11-28');
      expect(host.controls.fileBytes(where.path)).toBeDefined();
      expect(host.controls.heldLocks).toEqual([where.path]);
      expect(host.controls.backups).toHaveLength(1);
      expect(host.controls.fileEvents).toEqual([{ kind: 'created' }]);
      expect(session.current).toEqual(where);
    });

    it('suggestsAFileNameWithoutCharactersAFileSystemRefuses', async () => {
      const { host, session, suggestions } = setup();
      host.controls.queueSaveDialog(null);
      await session.create('a/b:c');
      await session.create('  ');
      expect(suggestions).toEqual(['a-b-c.folio', 'Budget.folio']);
    });
  });

  describe('aCancelledDialog', () => {
    it('writesNothingAndSaysCancelled', async () => {
      const { host, session } = setup();
      host.controls.queueSaveDialog(null);
      expect(await session.create('Household')).toEqual({
        ok: false,
        error: { kind: 'cancelled' },
      });
      expect(host.controls.fileEvents).toEqual([]);
    });
  });

  describe('aLocationLockedElsewhere', () => {
    it('isRefusedWithoutWritingAnything', async () => {
      const { host, session } = setup();
      host.controls.lockFromElsewhere(where.path, 'LAPTOP', false);
      host.controls.queueSaveDialog(where);
      expect(await session.create('Household')).toEqual({
        ok: false,
        error: { kind: 'locked', holder: 'LAPTOP', stale: false },
      });
      expect(host.controls.fileBytes(where.path)).toBeUndefined();
    });
  });
});

describe('FileSession.create over the open file', () => {
  describe('aLocationThatIsTheOpenFile', () => {
    it('leavesTheNewFileLocked', async () => {
      const { host, session } = setup();
      host.controls.queueSaveDialog(where);
      await session.create('Household 2027');
      host.controls.queueSaveDialog(where);
      expect((await session.create('Household 2027')).ok).toBe(true);
      expect(host.controls.heldLocks).toEqual([where.path]);
      expect(session.current).toEqual(where);
    });
  });

  describe('aWriteThatFailsWhileAnotherFileIsOpen', () => {
    it('releasesOnlyTheNewLocationAndKeepsTheOpenFile', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const failing = setup(
        { [where.path]: bytesOf(made.host, where) },
        { save: () => Promise.reject(new Error('disk full')) },
      );
      await failing.session.open(where);
      failing.host.controls.queueSaveDialog(other);
      expect(await failing.session.create('Other')).toEqual({
        ok: false,
        error: { kind: 'writeFailed' },
      });
      expect(failing.host.controls.heldLocks).toEqual([where.path]);
      expect(failing.session.current).toEqual(where);
    });
  });
});

describe('FileSession.open', () => {
  describe('aFileThatWasCreated', () => {
    it('opensAtOnceWithNoAccountsAndTheCreationMonth', async () => {
      const first = setup();
      first.host.controls.queueSaveDialog(where);
      await first.session.create('Household 2027');
      await first.session.close();
      const second = setup({ [where.path]: bytesOf(first.host, where) });
      const opened = await second.session.open(where);
      expect(opened.ok && opened.value.model.accounts).toEqual([]);
      expect(opened.ok && opened.value.model.settings.createdOn).toBe('2026-11-28');
      expect(second.host.controls.backups).toHaveLength(1);
      expect(second.host.controls.fileEvents).toEqual([
        { kind: 'opened', damagedLines: 0, fromBackup: false },
      ]);
    });
  });

  describe('aMissingFile', () => {
    it('failsWithNotFoundAndHoldsNoLock', async () => {
      const { host, session } = setup();
      expect(await session.open(where)).toEqual({ ok: false, error: { kind: 'notFound' } });
      expect(host.controls.heldLocks).toEqual([]);
      expect(host.controls.fileEvents).toEqual([{ kind: 'openFailed', reason: 'notFound' }]);
    });
  });

  describe('aFileLockedByAnotherComputer', () => {
    it('failsWithTheHolderAndOffersTakeOverOnlyWhenStale', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const bytes = bytesOf(made.host, where);

      const busy = setup({ [where.path]: bytes });
      busy.host.controls.lockFromElsewhere(where.path, 'LAPTOP', false);
      expect(await busy.session.open(where)).toEqual({
        ok: false,
        error: { kind: 'locked', holder: 'LAPTOP', stale: false },
      });

      const stale = setup({ [where.path]: bytes });
      stale.host.controls.lockFromElsewhere(where.path, 'LAPTOP', true);
      const refused = await stale.session.open(where);
      expect(refused.ok).toBe(false);
      const taken = await stale.session.open(where, { takeOverStale: true });
      expect(taken.ok).toBe(true);
    });
  });

  describe('aFileWithAFlippedByte', () => {
    it('failsWithInvalidFileAndOffersTheLatestBackup', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const good = bytesOf(made.host, where);
      const damaged = good.slice();
      const middle = Math.floor(damaged.length / 2);
      damaged[middle] = (damaged[middle] ?? 0) ^ 0xff;

      const { host, session } = setup({ [where.path]: good });
      await session.open(where);
      await session.close();
      host.controls.putFile(where.path, damaged);

      const failed = await session.open(where);
      expect(failed.ok).toBe(false);
      expect(!failed.ok && failed.error.kind).toBe('invalidFile');
      expect(
        !failed.ok && failed.error.kind === 'invalidFile' && failed.error.backup,
      ).not.toBeNull();
      expect(host.controls.heldLocks).toEqual([]);
      expect(host.controls.backups).toHaveLength(1);
    });
  });

  describe('aFileThatIsNotAZip', () => {
    it('failsWithNotAZip', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const { host, session } = setup({ [where.path]: bytesOf(made.host, where) });
      await session.open(where);
      await session.close();
      host.controls.putFile(where.path, new Uint8Array([1, 2, 3]));
      const failed = await session.open(where);
      expect(!failed.ok && failed.error.kind === 'invalidFile' && failed.error.failure).toEqual({
        code: 'notAZip',
      });
    });
  });

  describe('openingAnotherFileWhileOneIsOpen', () => {
    it('keepsTheFirstOpenWhenTheSecondFailsAndReleasesItWhenTheSecondOpens', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const bytes = bytesOf(made.host, where);
      const { host, session } = setup({ [where.path]: bytes, [other.path]: bytes });
      await session.open(where);

      host.controls.lockFromElsewhere(other.path, 'LAPTOP', false);
      expect((await session.open(other)).ok).toBe(false);
      expect(session.current).toEqual(where);
      expect(host.controls.heldLocks).toEqual([where.path]);

      const free = setup({ [where.path]: bytes, [other.path]: bytes });
      await free.session.open(where);
      expect((await free.session.open(other)).ok).toBe(true);
      expect(free.session.current).toEqual(other);
      expect(free.host.controls.heldLocks).toEqual([other.path]);
    });
  });
});

describe('FileSession.openBackup', () => {
  describe('aDamagedFileWithABackup', () => {
    it('opensTheBackupAndSavingReplacesTheDamagedFile', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const good = bytesOf(made.host, where);
      const { host, session } = setup({ [where.path]: good });
      await session.open(where);
      await session.close();
      host.controls.putFile(where.path, new Uint8Array([9, 9, 9]));
      const failed = await session.open(where);
      const backup = !failed.ok && failed.error.kind === 'invalidFile' ? failed.error.backup : null;
      expect(backup).not.toBeNull();

      const recovered = await session.openBackup(where, backup ?? where);
      expect(recovered.ok && recovered.value.fromBackup).toBe(true);
      expect(host.controls.fileEvents.at(-1)).toEqual({
        kind: 'opened',
        damagedLines: 0,
        fromBackup: true,
      });
      expect((await session.save(withAccount(modelOf(recovered)))).ok).toBe(true);
      expect(host.controls.fileBytes(where.path)).not.toEqual(new Uint8Array([9, 9, 9]));
    });
  });
});

describe('FileSession.openBackup failing', () => {
  describe('aLockedOriginalWhileAnotherFileIsOpen', () => {
    it('keepsTheFirstFileOpen', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const bytes = bytesOf(made.host, where);
      const { host, session } = setup({ [where.path]: bytes, [other.path]: bytes });
      await session.open(where);
      host.controls.lockFromElsewhere(other.path, 'LAPTOP', false);
      const failed = await session.openBackup(other, where);
      expect(failed.ok).toBe(false);
      expect(session.current).toEqual(where);
      expect(host.controls.heldLocks).toEqual([where.path]);
    });
  });

  describe('aBackupThatIsDamagedToo', () => {
    it('offersNoFurtherBackup', async () => {
      const made = setup();
      made.host.controls.queueSaveDialog(where);
      await made.session.create('Household 2027');
      const { host, session } = setup({ [where.path]: bytesOf(made.host, where) });
      await session.open(where);
      await session.close();
      host.controls.putFile(where.path, new Uint8Array([9]));
      const failed = await session.open(where);
      const backup = !failed.ok && failed.error.kind === 'invalidFile' ? failed.error.backup : null;
      host.controls.putFile((backup ?? where).path, new Uint8Array([8]));
      const again = await session.openBackup(where, backup ?? where);
      expect(!again.ok && again.error.kind === 'invalidFile' && again.error.backup).toBeNull();
      expect(host.controls.heldLocks).toEqual([]);
    });
  });
});

describe('FileSession.save', () => {
  describe('anEditedModel', () => {
    it('isWrittenAndOpensAgainWithTheEdit', async () => {
      const { host, session } = setup();
      host.controls.queueSaveDialog(where);
      const created = await session.create('Household 2027');
      const edited = withAccount(modelOf(created));
      expect((await session.save(edited)).ok).toBe(true);
      expect((await session.save(edited)).ok).toBe(true);
      await session.close();
      const again = setup({ [where.path]: bytesOf(host, where) });
      const opened = await again.session.open(where);
      expect(opened.ok && opened.value.model.accounts.map((account) => account.name)).toEqual([
        'Everyday',
      ]);
    });
  });

  describe('aFileChangedOnDiskSinceItWasRead', () => {
    it('isRefusedAndLeavesTheFileAlone', async () => {
      const { host, session } = setup();
      host.controls.queueSaveDialog(where);
      const created = await session.create('Household 2027');
      host.controls.putFile(where.path, new Uint8Array([7, 7]));
      const result = await session.save(modelOf(created));
      expect(result).toEqual({ ok: false, error: { kind: 'changedOnDisk' } });
      expect(host.controls.fileBytes(where.path)).toEqual(new Uint8Array([7, 7]));
    });
  });

  describe('noFileOpen', () => {
    it('failsWithNoFile', async () => {
      const { session } = setup();
      expect(await session.save(emptyModel)).toEqual({
        ok: false,
        error: { kind: 'noFile' },
      });
    });
  });
});

describe('FileSession.close', () => {
  describe('anOpenFile', () => {
    it('releasesTheLockAndForgetsTheFile', async () => {
      const { host, session } = setup();
      host.controls.queueSaveDialog(where);
      await session.create('Household 2027');
      await session.close();
      expect(host.controls.heldLocks).toEqual([]);
      expect(session.current).toBeNull();
    });
  });
});
