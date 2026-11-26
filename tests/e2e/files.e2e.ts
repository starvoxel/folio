// ------------------------------
// files.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { findPackagedApp } from './support/app-path.js';
import { launchApp, type LaunchedApp } from './support/launch-app.js';

test.describe('packagedAppFiles', () => {
  let folder = '';
  let userDataDirectory = '';
  let running: LaunchedApp | undefined;

  test.beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), 'folio-files-'));
    userDataDirectory = await mkdtemp(join(tmpdir(), 'folio-files-data-'));
  });

  test.afterEach(async () => {
    await running?.shutDown();
    running = undefined;
    await rm(folder, { recursive: true, force: true });
    await rm(userDataDirectory, { recursive: true, force: true });
  });

  test.describe('aFileThePageNeverChose', () => {
    test('isRefusedByEveryFileOperation', async () => {
      const stranger = join(folder, 'stranger.folio');
      await writeFile(stranger, 'private');
      running = await launchApp(findPackagedApp(), { userDataDirectory });
      const codes = await running.page.evaluate(async (path) => {
        const file = { path, name: 'stranger.folio' };
        const host = window.folioHost;
        const attempts = [
          () => host?.readFile(file),
          () => host?.writeFileAtomic(file, new Uint8Array([1]), null),
          () => host?.acquireLock(file),
          () => host?.backUp(file, new Uint8Array([1])),
        ];
        const results: string[] = [];
        for (const attempt of attempts) {
          try {
            await attempt();
            results.push('allowed');
          } catch (error) {
            results.push((error as Error).message.split(' ')[0] ?? 'unknown');
          }
        }
        return results;
      }, stranger);
      expect(codes).toEqual(Array<string>(4).fill('[permissionDenied]'));
      expect(await readFile(stranger, 'utf8')).toBe('private');
      expect(existsSync(`${stranger}.lock`)).toBe(false);
    });
  });

  test.describe('aFileChosenInTheSaveDialog', () => {
    test('savesLocksBacksUpReadsBackAndReleasesTheLockOnQuit', async () => {
      const budget = join(folder, 'Household.folio');
      running = await launchApp(findPackagedApp(), {
        userDataDirectory,
        environment: { FOLIO_AUTOMATION_DIALOG_PATH: budget },
      });
      const outcome = await running.page.evaluate(async () => {
        const host = window.folioHost;
        if (host === undefined) {
          throw new Error('no host');
        }
        const file = await host.showSaveDialog();
        if (file === null) {
          throw new Error('no file');
        }
        const saved = await host.writeFileAtomic(file, new Uint8Array([1, 2, 3]), null);
        const lock = await host.acquireLock(file);
        const backup = await host.backUp(file, new Uint8Array([1, 2, 3]));
        const read = await host.readFile(file);
        const stale = await host.writeFileAtomic(
          file,
          new Uint8Array([9]),
          saved.kind === 'saved' ? { ...saved.stamp, sizeBytes: 99 } : null,
        );
        return {
          saved: saved.kind,
          lock: lock.kind,
          backupName: backup.name,
          bytes: Array.from(read.bytes),
          stale: stale.kind,
        };
      });
      expect(outcome).toMatchObject({
        saved: 'saved',
        lock: 'acquired',
        bytes: [1, 2, 3],
        stale: 'changedOnDisk',
      });
      expect(outcome.backupName).toMatch(/^Household_\d{8}-\d{6}\.folio$/u);
      expect(existsSync(`${budget}.lock`)).toBe(true);
      expect(await readdir(folder)).not.toContain(outcome.backupName);

      expect(await running.shutDown()).toBe(0);
      running = undefined;
      expect(existsSync(`${budget}.lock`)).toBe(false);
      const backupFolders = await readdir(join(userDataDirectory, 'backups'));
      expect(backupFolders).toHaveLength(1);
    });
  });
});
