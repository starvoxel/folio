// ------------------------------
// package-contents.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { existsSync } from 'node:fs';

import { listPackage } from '@electron/asar';
import { FuseState, FuseV1Options, getCurrentFuseWire } from '@electron/fuses';
import { expect, test } from '@playwright/test';

import { findPackagedApp } from './support/app-path.js';

const ALLOWED_ENTRIES = [
  /^\/package\.json$/u,
  /^\/dist$/u,
  /^\/dist\/main$/u,
  /^\/dist\/main\/main\.cjs$/u,
  /^\/dist\/preload$/u,
  /^\/dist\/preload\/preload\.cjs$/u,
  /^\/dist\/renderer(\/.*)?$/u,
];

test.describe('packagedApp', () => {
  test.describe('archive', () => {
    test('holdsOnlyBundledCodeAndNoNodeModules', () => {
      const app = findPackagedApp();
      const entries = listPackage(app.asar, { isPack: false }).map((entry) =>
        entry.replaceAll('\\', '/'),
      );
      expect(entries.filter((entry) => entry.includes('node_modules'))).toEqual([]);
      expect(entries.filter((entry) => /\.(test\.|e2e\.|map$|ts$|tsx$)/u.test(entry))).toEqual([]);
      expect(
        entries.filter((entry) => !ALLOWED_ENTRIES.some((pattern) => pattern.test(entry))),
      ).toEqual([]);
      for (const required of [
        '/package.json',
        '/dist/main/main.cjs',
        '/dist/preload/preload.cjs',
        '/dist/renderer/index.html',
      ]) {
        expect(entries).toContain(required);
      }
    });

    test('hasNoUnpackedFolderBesideIt', () => {
      expect(existsSync(`${findPackagedApp().asar}.unpacked`)).toBe(false);
    });
  });

  test.describe('electronFuses', () => {
    test('matchTheHardeningOfAD18', async () => {
      const config = await getCurrentFuseWire(findPackagedApp().fuseTarget);
      expect(config[FuseV1Options.RunAsNode]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.EnableNodeOptionsEnvironmentVariable]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.EnableNodeCliInspectArguments]).toBe(FuseState.DISABLE);
      expect(config[FuseV1Options.OnlyLoadAppFromAsar]).toBe(FuseState.ENABLE);
      expect(config[FuseV1Options.EnableEmbeddedAsarIntegrityValidation]).toBe(FuseState.ENABLE);
      expect(config[FuseV1Options.EnableCookieEncryption]).toBe(FuseState.ENABLE);
      expect(config[FuseV1Options.GrantFileProtocolExtraPrivileges]).toBe(FuseState.DISABLE);
    });
  });
});
