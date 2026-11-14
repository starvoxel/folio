// ------------------------------
// main.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join } from 'node:path';

import { app, BrowserWindow, Menu } from 'electron';

import { findRefusedSwitches } from './debug-guard.js';
import { hardenBeforeReady, installHardening } from './hardening.js';
import { registerIpcHandlers } from './ipc.js';
import { createLogger, parseLogLevel } from './logger.js';
import { registerAppProtocol, registerAppScheme } from './protocol.js';
import { createSettingsStore } from './settings-store.js';
import { createMainWindow } from './window.js';

const logger = createLogger({
  level: parseLogLevel(process.env['FOLIO_LOG_LEVEL']),
  write: (line) => process.stderr.write(`${line}\n`),
  now: () => Date.now(),
});

/** Open the window once the app is ready, with the hardening and the handlers in place. */
async function openWhenReady(): Promise<void> {
  try {
    await app.whenReady();
    installHardening(logger);
    registerAppProtocol(join(app.getAppPath(), 'dist', 'renderer'));
    registerIpcHandlers({
      logger,
      settings: createSettingsStore(app.getPath('userData')),
    });
    // Windows and Linux have no menu bar (H1.14 uses the hamburger menu); macOS keeps a minimal
    // native menu so Cmd+Q, Cmd+C and Cmd+V work (H1.16). The full menu arrives with its plan.
    Menu.setApplicationMenu(
      process.platform === 'darwin'
        ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }])
        : null,
    );
    createMainWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
    logger.info('started', {
      version: app.getVersion(),
      platform: process.platform,
      packaged: app.isPackaged,
    });
  } catch (error) {
    logger.error('startup failed', { reason: error instanceof Error ? error.name : 'unknown' });
    app.exit(1);
  }
}

/**
 * Start the app. Everything the hardening needs before readiness runs first, then the window
 * opens once the app is ready.
 */
function start(): void {
  hardenBeforeReady();
  registerAppScheme();
  void openWhenReady();
  app.on('window-all-closed', () => {
    app.quit();
  });
}

// Chromium's remote debugging switches hand over complete control of the app and no fuse turns
// them off, so the app refuses them unless FOLIO_AUTOMATION=1 was set (AD-16, H1.17).
const refused = findRefusedSwitches(process.argv, process.env);
if (refused.length > 0) {
  process.stderr.write('Remote debugging switches are refused unless FOLIO_AUTOMATION=1.\n');
  app.exit(2);
} else {
  start();
}
