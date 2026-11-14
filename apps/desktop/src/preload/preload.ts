// ------------------------------
// preload.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// A sandboxed preload may require only `electron`; everything else is bundled in. Keep it small:
// this file is the whole surface the page can reach (AD-18).
import { contextBridge, ipcRenderer } from 'electron';

import {
  HostError,
  type FileRef,
  type HostApi,
  type HostInfo,
  type MenuCommand,
  type Unsubscribe,
} from '@folio/host-api';

import { IPC_CHANNELS, type IpcResult } from '../shared/ipc.js';

const MENU_COMMANDS: readonly string[] = [
  'new',
  'open',
  'save',
  'saveAs',
  'closeFile',
  'undo',
  'redo',
  'importCsv',
  'settings',
  'about',
];

/**
 * Call a main-process handler and unwrap its answer.
 * @param channel - The channel to invoke.
 * @param args - The arguments to send.
 * @returns The value of a successful answer.
 * @throws {HostError} When the handler reports a failure.
 */
async function call<Value>(channel: string, ...args: unknown[]): Promise<Value> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<Value>;
  if (!result.ok) {
    throw new HostError(result.code, result.message);
  }
  return result.value;
}

/**
 * Reject a host operation the scaffold does not implement yet.
 * @returns A promise that always rejects with an `unavailable` HostError.
 */
function notImplemented(): Promise<never> {
  return Promise.reject(new HostError('unavailable', 'This host operation is not built yet'));
}

/**
 * Subscribe to a main-to-renderer event.
 * @param channel - The channel to listen on.
 * @param accept - Turns the payload into a value for the listener, or null to drop it.
 * @param listener - The page's listener.
 * @returns A function that stops listening.
 */
function listen<Value>(
  channel: string,
  accept: (payload: unknown) => Value | null,
  listener: (value: Value) => void,
): Unsubscribe {
  const handler = (_event: unknown, payload: unknown): void => {
    const value = accept(payload);
    if (value !== null) {
      listener(value);
    }
  };
  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const host: HostApi = {
  getInfo: () => call<HostInfo>(IPC_CHANNELS.getInfo),
  readSettings: () => call<unknown>(IPC_CHANNELS.readSettings),
  writeSettings: async (settings) => {
    await call<null>(IPC_CHANNELS.writeSettings, settings);
  },
  quit: async () => {
    await call<null>(IPC_CHANNELS.quit);
  },
  onMenuCommand: (listener) =>
    listen<MenuCommand>(
      IPC_CHANNELS.menuCommand,
      (payload) =>
        typeof payload === 'string' && MENU_COMMANDS.includes(payload)
          ? (payload as MenuCommand)
          : null,
      listener,
    ),
  onFilesDropped: (listener) =>
    listen<readonly FileRef[]>(
      IPC_CHANNELS.filesDropped,
      (payload) => (Array.isArray(payload) ? (payload as readonly FileRef[]) : null),
      listener,
    ),
  showOpenDialog: notImplemented,
  showSaveDialog: notImplemented,
  readFile: notImplemented,
  writeFileAtomic: notImplemented,
  acquireLock: notImplemented,
  releaseLock: notImplemented,
  backUp: notImplemented,
  revealInFolder: notImplemented,
};

contextBridge.exposeInMainWorld('folioHost', Object.freeze(host));
