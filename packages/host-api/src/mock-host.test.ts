// ------------------------------
// mock-host.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { HostError, type FileRef, type MenuCommand } from './host-api.js';
import { createMockHost } from './mock-host.js';

const budget: FileRef = { path: 'folders/Household 2026.folio', name: 'Household 2026.folio' };
const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);

describe('createMockHost', () => {
  describe('defaultState', () => {
    it('reportsAWebHostWithoutAutomation', async () => {
      const host = createMockHost();
      expect(await host.getInfo()).toEqual({
        platform: 'web',
        automation: false,
        appVersion: '0.0.0-mock',
      });
    });
  });

  describe('infoOverrides', () => {
    it('reportsTheOverriddenFields', async () => {
      const host = createMockHost({ info: { automation: true, platform: 'win32' } });
      expect(await host.getInfo()).toMatchObject({ automation: true, platform: 'win32' });
    });
  });
});

describe('dialogs', () => {
  describe('noAnswerQueued', () => {
    it('returnsNullAsIfCancelled', async () => {
      const host = createMockHost();
      expect(await host.showOpenDialog()).toBeNull();
      expect(await host.showSaveDialog()).toBeNull();
    });
  });

  describe('answersQueued', () => {
    it('returnsThemInOrderOncePerCall', async () => {
      const host = createMockHost();
      host.controls.queueOpenDialog(budget);
      host.controls.queueOpenDialog(null);
      expect(await host.showOpenDialog()).toEqual(budget);
      expect(await host.showOpenDialog()).toBeNull();
      expect(await host.showOpenDialog()).toBeNull();
    });
  });
});

describe('readFile', () => {
  describe('existingFile', () => {
    it('returnsACopyOfTheBytesAndTheStamp', async () => {
      const host = createMockHost({ files: { [budget.path]: bytes(1, 2, 3) } });
      const contents = await host.readFile(budget);
      expect(contents.bytes).toEqual(bytes(1, 2, 3));
      expect(contents.stamp.sizeBytes).toBe(3);
      contents.bytes[0] = 99;
      expect(host.controls.fileBytes(budget.path)).toEqual(bytes(1, 2, 3));
    });
  });

  describe('missingFile', () => {
    it('rejectsWithANotFoundHostError', async () => {
      const host = createMockHost();
      await expect(host.readFile(budget)).rejects.toMatchObject({
        name: 'HostError',
        code: 'notFound',
      });
      await expect(host.readFile(budget)).rejects.toBeInstanceOf(HostError);
    });
  });
});

describe('writeFileAtomic', () => {
  describe('newFile', () => {
    it('savesAndReturnsAFreshStamp', async () => {
      const host = createMockHost();
      const result = await host.writeFileAtomic(budget, bytes(7), null);
      expect(result.kind).toBe('saved');
      expect(host.controls.fileBytes(budget.path)).toEqual(bytes(7));
    });
  });

  describe('fileUnchangedSinceItWasRead', () => {
    it('savesAndAdvancesTheStamp', async () => {
      const host = createMockHost({ files: { [budget.path]: bytes(1) } });
      const { stamp } = await host.readFile(budget);
      const result = await host.writeFileAtomic(budget, bytes(2, 2), stamp);
      expect(result.kind).toBe('saved');
      if (result.kind === 'saved') {
        expect(result.stamp).not.toEqual(stamp);
      }
    });
  });

  describe('fileChangedOnDisk', () => {
    it('refusesAndLeavesTheOtherVersion', async () => {
      const host = createMockHost({ files: { [budget.path]: bytes(1) } });
      const { stamp } = await host.readFile(budget);
      host.controls.putFile(budget.path, bytes(9, 9, 9));
      const result = await host.writeFileAtomic(budget, bytes(2), stamp);
      expect(result.kind).toBe('changedOnDisk');
      expect(host.controls.fileBytes(budget.path)).toEqual(bytes(9, 9, 9));
    });
  });
});

describe('locks', () => {
  describe('freeFile', () => {
    it('isAcquiredAndReleased', async () => {
      const host = createMockHost();
      expect(await host.acquireLock(budget)).toEqual({ kind: 'acquired' });
      expect(host.controls.heldLocks).toEqual([budget.path]);
      await host.releaseLock(budget);
      expect(host.controls.heldLocks).toEqual([]);
    });
  });

  describe('fileLockedFromElsewhere', () => {
    it('reportsTheHolderAndWhetherTheLockIsStale', async () => {
      const host = createMockHost();
      host.controls.lockFromElsewhere(budget.path, 'KITCHEN-PC', true);
      expect(await host.acquireLock(budget)).toEqual({
        kind: 'held',
        holder: 'KITCHEN-PC',
        stale: true,
      });
      expect(host.controls.heldLocks).toEqual([]);
    });
  });
});

describe('backUp', () => {
  describe('someBytes', () => {
    it('keepsACopyAndReturnsWhereItWent', async () => {
      const host = createMockHost();
      const original = bytes(5, 6);
      const copy = await host.backUp(budget, original);
      original[0] = 0;
      expect(copy.name).toBe('Household 2026.folio');
      expect(host.controls.backups).toEqual([{ file: copy, bytes: bytes(5, 6) }]);
    });
  });
});

describe('settings', () => {
  describe('noneStored', () => {
    it('readsNull', async () => {
      expect(await createMockHost().readSettings()).toBeNull();
    });
  });

  describe('writtenSettings', () => {
    it('readsBackWhatWasWritten', async () => {
      const host = createMockHost();
      await host.writeSettings({ theme: 'dark' });
      expect(await host.readSettings()).toEqual({ theme: 'dark' });
      expect(host.controls.settings).toEqual({ theme: 'dark' });
    });
  });
});

describe('events', () => {
  describe('menuCommand', () => {
    it('reachesListenersUntilTheyUnsubscribe', () => {
      const host = createMockHost();
      const seen: MenuCommand[] = [];
      const stop = host.onMenuCommand((command) => void seen.push(command));
      host.controls.emitMenuCommand('save');
      stop();
      host.controls.emitMenuCommand('undo');
      expect(seen).toEqual(['save']);
    });
  });

  describe('fileDrop', () => {
    it('reachesListenersUntilTheyUnsubscribe', () => {
      const host = createMockHost();
      const seen: (readonly FileRef[])[] = [];
      const stop = host.onFilesDropped((files) => void seen.push(files));
      host.controls.emitFilesDropped([budget]);
      stop();
      host.controls.emitFilesDropped([]);
      expect(seen).toEqual([[budget]]);
    });
  });
});

describe('revealInFolderAndQuit', () => {
  describe('calledOnce', () => {
    it('isRecordedForTests', async () => {
      const host = createMockHost();
      await host.revealInFolder(budget);
      await host.quit();
      expect(host.controls.revealed).toEqual([budget]);
      expect(host.controls.quitCount).toBe(1);
    });
  });
});
