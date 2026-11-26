// ------------------------------
// backup-store.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { basename, join } from 'node:path';

import type { FileRef } from '@folio/host-api';

import { writeAtomically } from './atomic-write.js';
import { backupFileName, backupsToDelete, BACKUPS_KEPT } from './backups.js';
import type { FsOps } from './fs-ops.js';

/** What was done by one backup. */
export interface BackupOutcome {
  readonly backup: FileRef;
  /** How many older backups were deleted to stay within the limit. */
  readonly pruned: number;
}

/**
 * Write a backup of a file's bytes into a folder of its own under the backup root, then delete
 * the oldest ones beyond the limit (AD-12). The copy is written the same crash-safe way as a save.
 * @param fs - The file system.
 * @param directory - The folder for this file's backups.
 * @param fileName - The budget file's name.
 * @param bytes - What to keep.
 * @param nowMs - The time, for the backup's name.
 * @param id - A unique id for the temporary file.
 * @param keep - How many backups to keep.
 * @returns The backup and the number pruned.
 */
export async function writeBackup(
  fs: FsOps,
  directory: string,
  fileName: string,
  bytes: Uint8Array,
  nowMs: number,
  id: string,
  keep: number = BACKUPS_KEPT,
): Promise<BackupOutcome> {
  await fs.makeDirectory(directory);
  const name = backupFileName(fileName, nowMs);
  const path = join(directory, name);
  await writeAtomically(fs, path, bytes, null, id);
  const stale = backupsToDelete(await fs.listDirectory(directory), fileName, keep);
  for (const old of stale) {
    await fs.remove(join(directory, old));
  }
  return { backup: { path, name: basename(path) }, pruned: stale.length };
}
