// ------------------------------
// settings-store.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSettingsStore } from '../../apps/desktop/src/main/settings-store.js';

let directory = '';

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'folio-settings-'));
});

afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('createSettingsStore', () => {
  describe('noFileYet', () => {
    it('readsNull', async () => {
      expect(await createSettingsStore(directory).read()).toBeNull();
    });
  });

  describe('writeThenRead', () => {
    it('roundTripsTheSettingsThroughARealFile', async () => {
      const store = createSettingsStore(directory);
      await store.write({ theme: 'dark' });
      expect(await store.read()).toEqual({ theme: 'dark' });
      expect(JSON.parse(await readFile(join(directory, 'settings.json'), 'utf8'))).toEqual({
        theme: 'dark',
      });
    });
  });

  describe('aFolderThatDoesNotExistYet', () => {
    it('isCreatedOnWrite', async () => {
      const nested = join(directory, 'a', 'b');
      await createSettingsStore(nested).write({ theme: 'light' });
      expect(await createSettingsStore(nested).read()).toEqual({ theme: 'light' });
    });
  });

  describe('settingsWithUnknownKeysAndBadValues', () => {
    it('storesOnlyValidSettings', async () => {
      const store = createSettingsStore(directory);
      await store.write({ theme: 'dark', secret: 'x'.repeat(100_000), nested: { a: 1 } });
      expect(await store.read()).toEqual({ theme: 'dark' });
      await store.write({ theme: 'neon' });
      expect(await store.read()).toEqual({ theme: 'system' });
    });
  });

  describe('notAnObject', () => {
    it('storesTheDefaults', async () => {
      const store = createSettingsStore(directory);
      await store.write('hello');
      expect(await store.read()).toEqual({ theme: 'system' });
    });
  });

  describe('aDamagedFile', () => {
    it('readsNullInsteadOfFailing', async () => {
      await writeFile(join(directory, 'settings.json'), '{ not json', 'utf8');
      expect(await createSettingsStore(directory).read()).toBeNull();
    });
  });

  describe('afterAWrite', () => {
    it('leavesNoTemporaryFileBehind', async () => {
      await createSettingsStore(directory).write({ theme: 'dark' });
      expect(await readdir(directory)).toEqual(['settings.json']);
    });
  });
});
