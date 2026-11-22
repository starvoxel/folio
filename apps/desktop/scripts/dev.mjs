// ------------------------------
// dev.mjs
//
// Author: Starvoxel AI Agent - 2026-11-22
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Builds the app and starts it unpackaged, for development: `npm run dev`. The app runs with the
 * repository root as its working folder, so a `.env` file there is read (see `.env.example`).
 * Arguments after `--` go to Electron, for example `npm run dev -- --no-sandbox` for a Linux
 * container that runs as root.
 *
 * An unpackaged run is not the packaged app: it has no fuses and writes its logs to `logs-dev`.
 */

import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const desktop = join(import.meta.dirname, '..');
const repository = join(desktop, '..', '..');

const build = spawnSync(process.execPath, [join(import.meta.dirname, 'build.mjs')], {
  stdio: 'inherit',
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// Electron's own command-line script downloads the binary on first use, which `require('electron')`
// does not.
const require = createRequire(import.meta.url);
const electronCli = join(dirname(require.resolve('electron/package.json')), 'cli.js');
const child = spawn(process.execPath, [electronCli, desktop, ...process.argv.slice(2)], {
  cwd: repository,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
child.on('exit', (code, signal) => {
  process.exit(code ?? (signal === null ? 0 : 1));
});
