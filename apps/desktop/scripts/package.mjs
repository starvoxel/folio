// ------------------------------
// package.mjs
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Packages the built app for the current platform (AD-20, unsigned) and flips the Electron fuses
 * (AD-18). The result is the one binary the end-to-end tests drive: there is no separate test
 * build. Run `npm run build` first; `npm run package` does both.
 *
 * Output: apps/desktop/release/<platform>-<arch>/, and the line `APP_PATH=<path>`.
 */

import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { FuseV1Options, FuseVersion, flipFuses } from '@electron/fuses';
import { packager } from '@electron/packager';

const desktop = join(import.meta.dirname, '..');
const stage = join(desktop, 'stage');
const release = join(desktop, 'release');

const manifest = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
const electronVersion = manifest.devDependencies.electron;

// The staged app is exactly what ships: a manifest and the built files. There is no node_modules.
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await cp(join(desktop, 'dist'), join(stage, 'dist'), { recursive: true });
await writeFile(
  join(stage, 'package.json'),
  `${JSON.stringify(
    {
      name: 'folio',
      productName: 'Folio',
      version: manifest.version,
      description: manifest.description,
      main: 'dist/main/main.cjs',
      license: manifest.license,
    },
    null,
    2,
  )}\n`,
);

await rm(release, { recursive: true, force: true });
const [appPath] = await packager({
  dir: stage,
  out: release,
  name: 'Folio',
  electronVersion,
  overwrite: true,
  asar: true,
  prune: false,
  quiet: true,
});
if (appPath === undefined) {
  throw new Error('The packager produced no output');
}

const executable = {
  linux: join(appPath, 'Folio'),
  win32: join(appPath, 'Folio.exe'),
  darwin: join(appPath, 'Folio.app'),
}[process.platform];
if (executable === undefined) {
  throw new Error(`Unsupported platform ${process.platform}`);
}

// Fuses (AD-18): no run-as-node, no NODE_OPTIONS, no Node inspector switches, only load the app
// from the asar and check its integrity, encrypt cookies, and no extra file-protocol privileges.
await flipFuses(executable, {
  version: FuseVersion.V1,
  resetAdHocDarwinSignature: process.platform === 'darwin',
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableCookieEncryption]: true,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
});

await rm(stage, { recursive: true, force: true });
console.log(`APP_PATH=${appPath}`);
