// ------------------------------
// index.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

export { mountApp, type MountedApp, type MountOptions } from './app/mount-app.js';
export type { AutomationApi, PageSnapshot } from './app/automation.js';
export { PAGE_IDS, PAGES, type PageDefinition, type PageId } from './app/pages.js';
export { testIds } from './app/test-ids.js';
export {
  createFileSession,
  type CreateFailure,
  type FileSession,
  type FileSessionDeps,
  type OpenedFile,
  type OpenFailure,
  type OpenOptions,
  type SaveFailure,
} from './session/file-session.js';
export { createHostSession } from './session/host-session.js';
export {
  describeCreateFailure,
  describeOpenFailure,
  describeSaveFailure,
  type FailureMessage,
} from './session/session-messages.js';
