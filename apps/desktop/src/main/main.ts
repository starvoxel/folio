// ------------------------------
// main.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow, dialog, Menu } from 'electron';

import { automationDialogAnswer, findRefusedSwitches } from './debug-guard.js';
import { createDesktopFileHost } from './desktop-file-host.js';
import { applyDevEnvFile } from './dev-env.js';
import { installErrorHandlers } from './error-handlers.js';
import { createFileDialogs } from './file-dialogs.js';
import { buildMacMenuTemplate } from './menu-template.js';
import type { FileHost } from './file-host.js';
import { hardenBeforeReady, installHardening } from './hardening.js';
import { registerIpcHandlers } from './ipc.js';
import { createRotatingFileWriter, nodeLogFileOperations } from './log-file.js';
import { createLogDestinations } from './log-destinations.js';
import { createLogger, createSessionId, parseLogLevel, parseUnredacted } from './logger.js';
import { createPathGrants } from './path-grants.js';
import { registerAppProtocol, registerAppScheme } from './protocol.js';
import { createSettingsStore } from './settings-store.js';
import { createMainWindow } from './window.js';
import { IPC_CHANNELS } from '../shared/ipc.js';

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

// Development only: a `.env` file in the folder the app was started from may set the logging
// variables and `FOLIO_AUTOMATION` (`dev-env.ts` lists the only keys it may set). A packaged build
// never reads it, and the real environment wins over the file.
const devEnv = applyDevEnvFile({
  packaged: app.isPackaged,
  env: process.env,
  readText: () => {
    try {
      return readFileSync(join(process.cwd(), '.env'), 'utf8');
    } catch {
      return undefined;
    }
  },
});

// Development only: `FOLIO_LOG_UNREDACTED=1` adds raw details in a second line. A packaged build
// ignores it (`parseUnredacted`, and `createLogDestinations` again), so no raw line is ever
// written there.
const destinations = createLogDestinations({
  packaged: app.isPackaged,
  unredacted: parseUnredacted(devEnv.env['FOLIO_LOG_UNREDACTED'], app.isPackaged),
  stderr: (line) => process.stderr.write(`${line}\n`),
  file: logFileWriter,
});

const logger = createLogger({
  level: parseLogLevel(devEnv.env['FOLIO_LOG_LEVEL']),
  ...destinations,
  now: () => Date.now(),
  appFolder: app.getAppPath(),
  sessionId: createSessionId((size) => randomBytes(size)),
});

if (devEnv.loaded.length > 0) {
  logger.debug('dev env file applied', { keys: devEnv.loaded.join(',') });
}

installErrorHandlers({
  logger,
  showError: (title, content) => {
    dialog.showErrorBox(title, content);
  },
  source: process,
});

/**
 * Release the file locks before the app exits, once, so a normal quit leaves no stale lock.
 * @param files - The file host that holds the locks.
 */
function releaseLocksBeforeQuit(files: FileHost): void {
  let released = false;
  app.on('before-quit', (event) => {
    if (released) {
      return;
    }
    event.preventDefault();
    released = true;
    void files
      .releaseAllLocks()
      .catch((error: unknown) => {
        logger.logError('releasing file locks failed', error);
      })
      .finally(() => {
        app.quit();
      });
  });
}

/** Open the window once the app is ready, with the hardening and the handlers in place. */
async function openWhenReady(): Promise<void> {
  try {
    await app.whenReady();
    installHardening(logger);
    registerAppProtocol(join(app.getAppPath(), 'dist', 'renderer'));
    const grants = createPathGrants();
    const files = createDesktopFileHost(app.getPath('userData'), grants, logger);
    registerIpcHandlers({
      logger,
      settings: createSettingsStore(app.getPath('userData')),
      files,
      dialogs: createFileDialogs(grants, automationDialogAnswer(devEnv.env)),
      grants,
      env: devEnv.env,
    });
    releaseLocksBeforeQuit(files);
    // Windows and Linux have no menu bar (H1.14 is the hamburger menu in the page); macOS has the
    // native menu of H1.16, whose commands go to the focused window.
    Menu.setApplicationMenu(
      process.platform === 'darwin'
        ? Menu.buildFromTemplate(
            buildMacMenuTemplate((command) => {
              BrowserWindow.getFocusedWindow()?.webContents.send(IPC_CHANNELS.menuCommand, command);
            }),
          )
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
const refused = findRefusedSwitches(process.argv, devEnv.env);
if (refused.length > 0) {
  process.stderr.write('Remote debugging switches are refused unless FOLIO_AUTOMATION=1.\n');
  app.exit(2);
} else {
  start();
}
