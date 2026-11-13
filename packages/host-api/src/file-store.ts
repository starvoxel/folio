// ------------------------------
// file-store.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type {
  FileContents,
  FileRef,
  FileStamp,
  HostApi,
  LockResult,
  WriteResult,
} from './host-api.js';

/**
 * Where budget files live (AD-19). It is narrower than `HostApi` on purpose: a household-hosted
 * server, later, can implement it without the dialogs and menus.
 */
export interface FileStore {
  /** Read a budget file and the stamp it was read at. */
  open(file: FileRef): Promise<FileContents>;
  /** Save a budget file, refusing when it changed on disk since `expected`. */
  save(file: FileRef, bytes: Uint8Array, expected: FileStamp | null): Promise<WriteResult>;
  /** Take the lock of a file. */
  lock(file: FileRef): Promise<LockResult>;
  /** Release the lock of a file. */
  unlock(file: FileRef): Promise<void>;
  /** Keep a copy of the bytes as a backup. */
  backUp(file: FileRef, bytes: Uint8Array): Promise<FileRef>;
}

/**
 * Make a file store that keeps budget files through a host.
 * @param host - The host that does the file work.
 * @returns A file store backed by the host.
 */
export function createHostFileStore(host: HostApi): FileStore {
  return {
    open: (file) => host.readFile(file),
    save: (file, bytes, expected) => host.writeFileAtomic(file, bytes, expected),
    lock: (file) => host.acquireLock(file),
    unlock: (file) => host.releaseLock(file),
    backUp: (file, bytes) => host.backUp(file, bytes),
  };
}
