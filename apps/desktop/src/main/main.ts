// ------------------------------
// main.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { randomBytes } from 'node:crypto';
import { join } from 'node:path';

import { app, BrowserWindow, dialog, Menu } from 'electron';

import { findRefusedSwitches } from './debug-guard.js';
import { installErrorHandlers } from './error-handlers.js';
import { hardenBeforeReady, installHardening } from './hardening.js';
import { registerIpcHandlers } from './ipc.js';
import { createRotatingFileWriter, nodeLogFileOperations } from './log-file.js';
import { createLogDestinations } from './log-destinations.js';
import { createLogger, createSessionId, parseLogLevel, parseUnredacted } from './logger.js';
import { registerAppProtocol, registerAppScheme } from './protocol.js';
import { createSettingsStore } from './settings-store.js';
import { createMainWindow } from './window.js';

// A closed pipe (EPIPE) makes standard error emit an error event, and an event nobody listens to
// would crash the app. Logging must never do that.
process.stderr.on('error', () => undefined);

// Packaged builds have no console, so lines also go to a file in the app's data folder (see
// plans/logging.md); unpackaged runs use `logs-dev`. The folder is read on the first line.
const logFileWriter = (fileName: string): ((line: string) => void) => {
  let writer: ((line: string) => void) | undefined;
  return (line) => {
    writer ??= createRotatingFileWriter({
      folder: join(app.getPath('userData'), app.isPackaged ? 'logs' : 'logs-dev'),
      fileName,
      files: nodeLogFileOperations,
    });
    writer(line);
  };
};

// Development only: `FOLIO_LOG_UNREDACTED=1` adds raw details in a second line. A packaged build
// ignores it (`parseUnredacted`, and `createLogDestinations` again), so no raw line is ever
// written there.
const destinations = createLogDestinations({
  packaged: app.isPackaged,
  unredacted: parseUnredacted(process.env['FOLIO_LOG_UNREDACTED'], app.isPackaged),
  stderr: (line) => process.stderr.write(`${line}\n`),
  file: logFileWriter,
});

const logger = createLogger({
  level: parseLogLevel(process.env['FOLIO_LOG_LEVEL']),
  ...destinations,
  now: () => Date.now(),
  appFolder: app.getAppPath(),
  sessionId: createSessionId((size) => randomBytes(size)),
});

installErrorHandlers({
  logger,
  showError: (title, content) => {
    dialog.showErrorBox(title, content);
  },
  source: process,
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
    logger.logError('startup failed', error);
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
