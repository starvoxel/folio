// ------------------------------
// file-store.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createHostFileStore } from './file-store.js';
import type { FileRef } from './host-api.js';
import { createMockHost } from './mock-host.js';

const budget: FileRef = { path: 'Household 2026.folio', name: 'Household 2026.folio' };

describe('createHostFileStore', () => {
  describe('openThenSave', () => {
    it('roundTripsBytesThroughTheHost', async () => {
      const host = createMockHost({ files: { [budget.path]: new Uint8Array([1, 2]) } });
      const store = createHostFileStore(host);
      const opened = await store.open(budget);
      const saved = await store.save(budget, new Uint8Array([3, 4, 5]), opened.stamp);
      expect(saved.kind).toBe('saved');
      expect(host.controls.fileBytes(budget.path)).toEqual(new Uint8Array([3, 4, 5]));
    });
  });

  describe('fileChangedBetweenOpenAndSave', () => {
    it('reportsTheConflictInsteadOfOverwriting', async () => {
      const host = createMockHost({ files: { [budget.path]: new Uint8Array([1]) } });
      const store = createHostFileStore(host);
      const opened = await store.open(budget);
      host.controls.putFile(budget.path, new Uint8Array([8]));
      const saved = await store.save(budget, new Uint8Array([2]), opened.stamp);
      expect(saved.kind).toBe('changedOnDisk');
      expect(host.controls.fileBytes(budget.path)).toEqual(new Uint8Array([8]));
    });
  });

  describe('lockAndUnlock', () => {
    it('takesAndReleasesTheHostLock', async () => {
      const host = createMockHost();
      const store = createHostFileStore(host);
      expect(await store.lock(budget)).toEqual({ kind: 'acquired' });
      await store.unlock(budget);
      expect(host.controls.heldLocks).toEqual([]);
    });
  });

  describe('backUp', () => {
    it('keepsACopyInTheHostBackups', async () => {
      const host = createMockHost();
      const store = createHostFileStore(host);
      await store.backUp(budget, new Uint8Array([4]));
      expect(host.controls.backups).toHaveLength(1);
    });
  });

  describe('missingFile', () => {
    it('rejectsOnOpen', async () => {
      const store = createHostFileStore(createMockHost());
      await expect(store.open(budget)).rejects.toMatchObject({ code: 'notFound' });
    });
  });
});
