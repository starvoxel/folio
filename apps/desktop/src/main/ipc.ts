// ------------------------------
// ipc.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';

import type { HostInfo } from '@folio/host-api';

import { isAppUrl } from './app-origin.js';
import { isAutomationEnabled } from './debug-guard.js';
import type { Logger } from './logger.js';
import type { SettingsStore } from './settings-store.js';
import { IPC_CHANNELS, type IpcResult } from '../shared/ipc.js';

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
 * text, so no data from the failing call leaks into the renderer or the log.
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
  } catch {
    logger.error('ipc handler failed', { handler: name });
    return { ok: false, code: 'unavailable', message: 'The host could not complete the request' };
  }
}

/** What the handlers need. */
export interface IpcServices {
  readonly logger: Logger;
  readonly settings: SettingsStore;
}

/**
 * Register the handlers for the channels in `IPC_CHANNELS`. Only the host operations the
 * scaffold implements are registered; the rest are refused in the preload bridge, so the main
 * process has no handler to attack for them.
 * @param services - The logger and the settings store.
 */
export function registerIpcHandlers(services: IpcServices): void {
  const { logger, settings } = services;
  ipcMain.handle(IPC_CHANNELS.getInfo, (event): Promise<IpcResult<HostInfo>> => {
    assertTrustedSender(event);
    return guarded(logger, 'getInfo', () => ({
      platform:
        process.platform === 'win32' || process.platform === 'darwin' ? process.platform : 'linux',
      automation: isAutomationEnabled(process.env),
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
  ipcMain.handle(IPC_CHANNELS.quit, (event): Promise<IpcResult<null>> => {
    assertTrustedSender(event);
    return guarded(logger, 'quit', () => {
      app.quit();
      return null;
    });
  });
}
