// ------------------------------
// preload.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// A sandboxed preload may require only `electron`; everything else is bundled in. Keep it small:
// this file is the whole surface the page can reach (AD-18).
import { contextBridge, ipcRenderer, webUtils } from 'electron';

import {
  HostError,
  tagHostErrorMessage,
  type FileContents,
  type FileRef,
  type HostApi,
  type HostInfo,
  type LockResult,
  type MenuCommand,
  type Unsubscribe,
  type WriteResult,
} from '@folio/host-api';

import { IPC_CHANNELS, type IpcResult } from '../shared/ipc.js';
import { parseFileRef } from '../shared/ipc-requests.js';
import { watchFileDrops, type DropTarget } from './file-drops.js';

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
    // The context bridge copies only the message, so the code travels in it.
    throw new HostError(result.code, tagHostErrorMessage(result.code, result.message));
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
      (payload) => {
        const refs = Array.isArray(payload)
          ? (payload as unknown[]).map((entry) => parseFileRef(entry))
          : [];
        return refs.length > 0 && refs.every((ref) => ref !== null) ? refs : null;
      },
      listener,
    ),
  showOpenDialog: (options) => call<FileRef | null>(IPC_CHANNELS.showOpenDialog, options),
  showSaveDialog: (options) => call<FileRef | null>(IPC_CHANNELS.showSaveDialog, options),
  readFile: (file) => call<FileContents>(IPC_CHANNELS.readFile, file),
  writeFileAtomic: (file, bytes, expected) =>
    call<WriteResult>(IPC_CHANNELS.writeFileAtomic, { file, bytes, expected }),
  acquireLock: (file, options) => call<LockResult>(IPC_CHANNELS.acquireLock, { file, options }),
  releaseLock: async (file) => {
    await call<null>(IPC_CHANNELS.releaseLock, file);
  },
  backUp: (file, bytes) => call<FileRef>(IPC_CHANNELS.backUp, { file, bytes }),
  revealInFolder: notImplemented,
};

watchFileDrops(
  globalThis as unknown as DropTarget,
  (file) => webUtils.getPathForFile(file as File),
  (paths) => {
    void ipcRenderer.invoke(IPC_CHANNELS.dropFiles, paths);
  },
);
contextBridge.exposeInMainWorld('folioHost', Object.freeze(host));
// The main process answers these only when started with FOLIO_AUTOMATION=1; otherwise it has no
// handler and a call is refused, so exposing the functions grants nothing (AD-16).
contextBridge.exposeInMainWorld(
  'folioAutomation',
  Object.freeze({
    clickMenuItem: (path: readonly string[]) =>
      call<boolean>(IPC_CHANNELS.automationClickMenu, path),
    describeMenu: () => call<unknown>(IPC_CHANNELS.automationDescribeMenu),
  }),
);
