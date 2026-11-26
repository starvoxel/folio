// ------------------------------
// atomic-write.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { basename, dirname, join } from 'node:path';

import { HostError, type FileContents, type FileStamp, type WriteResult } from '@folio/host-api';

import type { FsOps, FsStat } from './fs-ops.js';

/**
 * Turn what the file system reports into the stamp the on-disk change check compares (AD-12).
 * @param found - The modification time and size.
 * @returns The stamp. The time is cut to whole milliseconds, which every file system keeps.
 */
export function stampOf(found: FsStat): FileStamp {
  return { modifiedMs: Math.trunc(found.mtimeMs), sizeBytes: found.size };
}

/**
 * Compare two stamps.
 * @param left - One stamp.
 * @param right - The other.
 * @returns True when time and size are the same.
 */
export function sameStamp(left: FileStamp, right: FileStamp): boolean {
  return left.modifiedMs === right.modifiedMs && left.sizeBytes === right.sizeBytes;
}

/**
 * The name of the temporary file next to the target. It starts with a dot and carries a unique
 * id, so two writers never share one and a leftover is easy to recognise.
 * @param target - The file being replaced.
 * @param id - A unique id for this write.
 * @returns The path of the temporary file, in the target's folder so the rename stays on one volume.
 */
export function temporaryPathFor(target: string, id: string): string {
  return join(dirname(target), `.${basename(target)}.${id}.tmp`);
}

/**
 * Read a whole file together with the stamp it had. The stamp is taken before the read, so a
 * change that lands during the read is caught by the next save rather than hidden.
 * @param fs - The file system.
 * @param path - The file.
 * @returns The bytes and the stamp.
 * @throws {HostError} `notFound` when the file does not exist.
 */
export async function readStamped(fs: FsOps, path: string): Promise<FileContents> {
  const found = await fs.stat(path);
  if (found === null) {
    throw new HostError('notFound', 'The file does not exist');
  }
  return { bytes: await fs.readFile(path), stamp: stampOf(found) };
}

/**
 * Replace a file so that a crash leaves either the old file or the new one, never a mix: write a
 * temporary file beside it, flush it, rename it over the target, then flush the folder (AD-12).
 * When `expected` is given and the file on disk no longer matches, nothing is written.
 * @param fs - The file system.
 * @param path - The target file.
 * @param bytes - The new contents.
 * @param expected - The stamp the caller last saw, or null for a file it has not read.
 * @param id - A unique id for the temporary file.
 * @returns `saved` with the new stamp, or `changedOnDisk` with what is there now.
 * @throws {HostError} `notFound` when `expected` is given and the file is gone.
 */
export async function writeAtomically(
  fs: FsOps,
  path: string,
  bytes: Uint8Array,
  expected: FileStamp | null,
  id: string,
): Promise<WriteResult> {
  const current = await fs.stat(path);
  if (expected !== null) {
    if (current === null) {
      throw new HostError('notFound', 'The file does not exist');
    }
    if (!sameStamp(expected, stampOf(current))) {
      return { kind: 'changedOnDisk', current: stampOf(current) };
    }
  }
  const temporary = temporaryPathFor(path, id);
  try {
    await fs.writeFileSynced(temporary, bytes);
    await fs.rename(temporary, path);
  } catch (error) {
    await fs.remove(temporary).catch(() => undefined);
    throw error;
  }
  await fs.syncDirectory(dirname(path)).catch(() => undefined);
  const written = await fs.stat(path);
  if (written === null) {
    throw new HostError('unavailable', 'The file was not there after saving');
  }
  return { kind: 'saved', stamp: stampOf(written) };
}
