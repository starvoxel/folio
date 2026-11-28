// ------------------------------
// file-host.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { basename, join } from 'node:path';

import {
  HostError,
  type FileContents,
  type FileRef,
  type FileStamp,
  type LockOptions,
  type LockResult,
  type WriteResult,
} from '@folio/host-api';

import { newestBackup } from './backups.js';
import { writeBackup } from './backup-store.js';
import { readStamped, writeAtomically } from './atomic-write.js';
import type { FsOps } from './fs-ops.js';
import { createLockManager, type LockManager } from './lock-manager.js';
import type { Logger } from './logger.js';
import type { PathGrants } from './path-grants.js';
import { createSerialQueue } from './serial-queue.js';
import type { LockInfo } from './lock-file.js';

/** What the file host needs from the machine. */
export interface FileHostDeps {
  readonly fs: FsOps;
  readonly grants: PathGrants;
  readonly logger: Logger;
  /** The folder all backups live under, normally inside the app-data folder (AD-12). */
  readonly backupRoot: string;
  readonly self: LockInfo;
  readonly nowMs: () => number;
  readonly isProcessAlive: (pid: number) => boolean;
  /** A short unique id, for temporary file names. */
  readonly uniqueId: () => string;
  /** A short stable text for a path, so each file's backups get a folder of their own. */
  readonly hashOf: (text: string) => string;
}

/** The main-process side of the file operations of `HostApi` (AD-12, AD-19). */
export interface FileHost {
  readFile(file: FileRef): Promise<FileContents>;
  writeFileAtomic(
    file: FileRef,
    bytes: Uint8Array,
    expected: FileStamp | null,
  ): Promise<WriteResult>;
  acquireLock(file: FileRef, options?: LockOptions): Promise<LockResult>;
  releaseLock(file: FileRef): Promise<void>;
  backUp(file: FileRef, bytes: Uint8Array): Promise<FileRef>;
  /** The newest backup of a file, which the person may then read; null when there is none. */
  latestBackup(file: FileRef): Promise<FileRef | null>;
  /** Release every lock this app holds, for quitting. */
  releaseAllLocks(): Promise<void>;
}

/**
 * Create the file host. Every operation first checks that the path was chosen by the person
 * (see `PathGrants`); a path from anywhere else is refused and logged without the path. Logs carry
 * counts and outcomes only: no file names, paths or contents (AD-10).
 * @param deps - The machine and the services around it.
 * @returns The file host.
 */
export function createFileHost(deps: FileHostDeps): FileHost {
  const { fs, grants, logger } = deps;
  const locks: LockManager = createLockManager({
    fs,
    self: deps.self,
    nowMs: deps.nowMs,
    isProcessAlive: deps.isProcessAlive,
    uniqueId: deps.uniqueId,
    onStaleTakenOver: () => {
      logger.warn('replaced a stale lock');
    },
  });

  // Two backups of one file in flight at once would pick the same name and lose one.
  const backupQueue = createSerialQueue();

  const checked = (file: FileRef, operation: string, forReading = false): string => {
    const allowed = forReading ? grants.isReadable(file.path) : grants.isGranted(file.path);
    if (!allowed) {
      logger.warn('refused a file the person did not choose', { operation });
      throw new HostError('permissionDenied', 'The file was not chosen in a dialog');
    }
    return file.path;
  };

  return {
    readFile: async (file) => readStamped(fs, checked(file, 'readFile', true)),
    writeFileAtomic: async (file, bytes, expected) => {
      const result = await writeAtomically(
        fs,
        checked(file, 'writeFileAtomic'),
        bytes,
        expected,
        deps.uniqueId(),
      );
      if (result.kind === 'changedOnDisk') {
        logger.warn('refused to save: the file changed on disk');
      } else {
        logger.info('saved a file', { bytes: bytes.byteLength });
      }
      return result;
    },
    acquireLock: async (file, options) => {
      const result = await locks.acquire(checked(file, 'acquireLock'), options);
      if (result.kind === 'held') {
        logger.warn('a file is locked by another holder', { stale: result.stale });
      } else {
        logger.info('took a file lock');
      }
      return result;
    },
    releaseLock: async (file) => {
      if (await locks.release(checked(file, 'releaseLock'))) {
        logger.info('released a file lock');
      }
    },
    backUp: async (file, bytes) => {
      const path = checked(file, 'backUp');
      const directory = join(deps.backupRoot, deps.hashOf(grants.keyOf(path) ?? path));
      const { backup, pruned } = await backupQueue.run(directory, () =>
        writeBackup(fs, directory, basename(path), bytes, deps.nowMs(), deps.uniqueId()),
      );
      logger.info('wrote a backup', { bytes: bytes.byteLength, pruned });
      return backup;
    },
    latestBackup: async (file) => {
      const path = checked(file, 'latestBackup');
      const directory = join(deps.backupRoot, deps.hashOf(grants.keyOf(path) ?? path));
      const name = newestBackup(await fs.listDirectory(directory), basename(path));
      if (name === null) {
        return null;
      }
      // Reading only: a page that can write a backup could replace the copy offered after damage.
      const backup = join(directory, name);
      grants.grantReadOnly(backup);
      return { path: backup, name };
    },
    releaseAllLocks: () => locks.releaseAll(),
  };
}
