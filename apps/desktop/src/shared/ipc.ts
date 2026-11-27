// ------------------------------
// ipc.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { HostErrorCode } from '@folio/host-api';

/** The IPC channels between the preload bridge and the main process. Nothing else is handled. */
export const IPC_CHANNELS = {
  getInfo: 'folio:get-info',
  readSettings: 'folio:read-settings',
  writeSettings: 'folio:write-settings',
  showOpenDialog: 'folio:show-open-dialog',
  showSaveDialog: 'folio:show-save-dialog',
  readFile: 'folio:read-file',
  writeFileAtomic: 'folio:write-file-atomic',
  acquireLock: 'folio:acquire-lock',
  releaseLock: 'folio:release-lock',
  backUp: 'folio:back-up',
  quit: 'folio:quit',
  menuCommand: 'folio:menu-command',
  filesDropped: 'folio:files-dropped',
  dropFiles: 'folio:drop-files',
  automationClickMenu: 'folio:automation-click-menu',
  automationDescribeMenu: 'folio:automation-describe-menu',
} as const;

/** The answer of a main-process handler: a value, or a failure the bridge turns into a HostError. */
export type IpcResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly code: HostErrorCode; readonly message: string };
