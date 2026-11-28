// ------------------------------
// index.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

export {
  FORM_FACTORS,
  HostError,
  hostErrorCode,
  OPEN_FAILURE_REASONS,
  tagHostErrorMessage,
  type FileContents,
  type FileEvent,
  type FileFilter,
  type FileRef,
  type FileStamp,
  type FormFactor,
  type HostApi,
  type HostErrorCode,
  type HostInfo,
  type InputStyle,
  type LockOptions,
  type LockResult,
  type MenuCommand,
  type OpenDialogOptions,
  type OpenFailureReason,
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
