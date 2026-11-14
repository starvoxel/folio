// ------------------------------
// app-path.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** The repository root. */
const repositoryRoot = join(import.meta.dirname, '..', '..', '..');

/** The folders and files of a packaged app on this platform. */
export interface PackagedApp {
  /** The folder the packager wrote, such as `Folio-linux-x64`. */
  readonly directory: string;
  /** The file that starts the app. */
  readonly executable: string;
  /** What the fuse tooling is pointed at (the .app bundle on macOS). */
  readonly fuseTarget: string;
  /** The archive that holds the app's code. */
  readonly asar: string;
}

/**
 * Find the packaged app. `FOLIO_APP_PATH` may name the packager's output folder; otherwise the
 * default location under apps/desktop/release is used.
 * @returns Where the pieces of the packaged app are.
 * @throws {Error} When the app has not been packaged.
 */
export function findPackagedApp(): PackagedApp {
  const directory =
    process.env['FOLIO_APP_PATH'] ??
    join(repositoryRoot, 'apps', 'desktop', 'release', `Folio-${process.platform}-${process.arch}`);
  const app: PackagedApp =
    process.platform === 'darwin'
      ? {
          directory,
          executable: join(directory, 'Folio.app', 'Contents', 'MacOS', 'Folio'),
          fuseTarget: join(directory, 'Folio.app'),
          asar: join(directory, 'Folio.app', 'Contents', 'Resources', 'app.asar'),
        }
      : {
          directory,
          executable: join(directory, process.platform === 'win32' ? 'Folio.exe' : 'Folio'),
          fuseTarget: join(directory, process.platform === 'win32' ? 'Folio.exe' : 'Folio'),
          asar: join(directory, 'resources', 'app.asar'),
        };
  if (!existsSync(app.executable)) {
    throw new Error(
      `The packaged app is missing at ${app.executable}. Run "npm run package" first, ` +
        'or set FOLIO_APP_PATH to the packager output folder.',
    );
  }
  return app;
}

/**
 * Chromium switches the tests add on every launch. Linux machines without a configured sandbox
 * (containers, most CI images) need `--no-sandbox` to start at all; Windows and macOS, which are
 * where the end-to-end suite runs in CI, start with the real sandbox.
 * @returns The extra arguments.
 */
export function platformLaunchArguments(): string[] {
  return process.platform === 'linux' ? ['--no-sandbox'] : [];
}
