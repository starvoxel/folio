// ------------------------------
// ipc.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { FileContents, FileRef, HostInfo, LockResult, WriteResult } from '@folio/host-api';

import { isAppUrl } from './app-origin.js';
import { isAutomationEnabled } from './debug-guard.js';
import type { FileDialogs } from './file-dialogs.js';
import type { FileHost } from './file-host.js';
import { failureFor, invalidRequest } from './ipc-failures.js';
import type { Logger } from './logger.js';
import type { SettingsStore } from './settings-store.js';
import { IPC_CHANNELS, type IpcResult } from '../shared/ipc.js';
import {
  parseBackUpRequest,
  parseDialogOptions,
  parseFileRef,
  parseLockRequest,
  parseWriteRequest,
} from '../shared/ipc-requests.js';

/**
 * Refuse messages that do not come from the app page. A frame from anywhere else must never
 * reach a handler, whatever it sends (AD-18).
 * @param event - The invoke event.
 * @throws {Error} When the sender is not the app page.
 */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? '';
  if (!isAppUrl(url)) {
    throw new Error('Refused a message from an untrusted sender');
  }
}

/**
 * Run a handler and turn its failure into a result the bridge can rethrow. The message is fixed
 * text, so no data from the failing call leaks into the renderer, and the log gets the error's
 * name and stack frames without its message.
 * @param logger - Where failures are noted.
 * @param name - The handler name for the log.
 * @param work - The work to do.
 * @returns The value or a failure.
 */
async function guarded<Value>(
  logger: Logger,
  name: string,
  work: () => Promise<Value> | Value,
): Promise<IpcResult<Value>> {
  try {
    return { ok: true, value: await work() };
  } catch (error) {
    logger.logError('ipc handler failed', error, { handler: name });
    return { ok: false, ...failureFor(error) };
  }
}

/** What the handlers need. */
export interface IpcServices {
  readonly logger: Logger;
  readonly settings: SettingsStore;
  readonly files: FileHost;
  readonly dialogs: FileDialogs;
  /** The environment the app runs with, which decides whether automation is on (AD-16). */
  readonly env: Readonly<Record<string, string | undefined>>;
}

/**
 * Register the handlers for the channels in `IPC_CHANNELS`. Only the host operations that are
 * built are registered; the rest are refused in the preload bridge, so the main process has no
 * handler to attack for them. Every payload is checked before it reaches the file host.
 * @param services - The logger, settings, file host, dialogs and the environment.
 */
export function registerIpcHandlers(services: IpcServices): void {
  const { logger, settings, env, files, dialogs } = services;
  ipcMain.handle(IPC_CHANNELS.getInfo, (event): Promise<IpcResult<HostInfo>> => {
    assertTrustedSender(event);
    return guarded(logger, 'getInfo', () => ({
      platform:
        process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux',
      formFactor: 'desktop',
      input: { pointer: 'fine', hover: true },
      automation: isAutomationEnabled(env),
      appVersion: app.getVersion(),
    }));
  });
  ipcMain.handle(IPC_CHANNELS.readSettings, (event): Promise<IpcResult<unknown>> => {
    assertTrustedSender(event);
    return guarded(logger, 'readSettings', () => settings.read());
  });
  ipcMain.handle(
    IPC_CHANNELS.writeSettings,
    (event, payload: unknown): Promise<IpcResult<null>> => {
      assertTrustedSender(event);
      return guarded(logger, 'writeSettings', async () => {
        await settings.write(payload);
        return null;
      });
    },
  );
  /**
   * Register a handler that checks its payload, then runs the work.
   * @param channel - The channel.
   * @param name - The handler name for the log.
   * @param parse - Checks the untrusted payload; null means malformed.
   * @param work - The work on a checked payload.
   */
  const handleChecked = <Request, Value>(
    channel: string,
    name: string,
    parse: (payload: unknown) => Request | null,
    work: (request: Request, event: IpcMainInvokeEvent) => Promise<Value> | Value,
  ): void => {
    ipcMain.handle(channel, (event, payload: unknown): Promise<IpcResult<Value>> => {
      assertTrustedSender(event);
      const request = parse(payload);
      if (request === null) {
        logger.warn('refused a malformed request', { handler: name });
        return Promise.resolve({ ok: false, ...invalidRequest() });
      }
      return guarded(logger, name, () => work(request, event));
    });
  };

  handleChecked(
    IPC_CHANNELS.showOpenDialog,
    'showOpenDialog',
    (payload) => parseDialogOptions(payload, false),
    (options, event): Promise<FileRef | null> => dialogs.open(event.sender, options),
  );
  handleChecked(
    IPC_CHANNELS.showSaveDialog,
    'showSaveDialog',
    (payload) => parseDialogOptions(payload, true),
    (options, event): Promise<FileRef | null> => dialogs.save(event.sender, options),
  );
  handleChecked(IPC_CHANNELS.readFile, 'readFile', parseFileRef, (file): Promise<FileContents> =>
    files.readFile(file),
  );
  handleChecked(
    IPC_CHANNELS.writeFileAtomic,
    'writeFileAtomic',
    parseWriteRequest,
    (request): Promise<WriteResult> =>
      files.writeFileAtomic(request.file, request.bytes, request.expected),
  );
  handleChecked(
    IPC_CHANNELS.acquireLock,
    'acquireLock',
    parseLockRequest,
    (request): Promise<LockResult> => files.acquireLock(request.file, request.options),
  );
  handleChecked(
    IPC_CHANNELS.releaseLock,
    'releaseLock',
    parseFileRef,
    async (file): Promise<null> => {
      await files.releaseLock(file);
      return null;
    },
  );
  handleChecked(IPC_CHANNELS.backUp, 'backUp', parseBackUpRequest, (request): Promise<FileRef> =>
    files.backUp(request.file, request.bytes),
  );

  ipcMain.handle(IPC_CHANNELS.quit, (event): Promise<IpcResult<null>> => {
    assertTrustedSender(event);
    return guarded(logger, 'quit', () => {
      app.quit();
      return null;
    });
  });
}
