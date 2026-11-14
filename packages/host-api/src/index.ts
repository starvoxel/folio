// ------------------------------
// index.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

export {
  HostError,
  type FileContents,
  type FileFilter,
  type FileRef,
  type FileStamp,
  type HostApi,
  type HostErrorCode,
  type HostInfo,
  type LockResult,
  type MenuCommand,
  type OpenDialogOptions,
  type SaveDialogOptions,
  type Unsubscribe,
  type WriteResult,
} from './host-api.js';
export { createHostFileStore, type FileStore } from './file-store.js';
export {
  createMockHost,
  type MockHost,
  type MockHostControls,
  type MockHostOptions,
} from './mock-host.js';
