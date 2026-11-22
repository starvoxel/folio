// ------------------------------
// log-file.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { appendFileSync, mkdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The default size at which the log file is rotated, in bytes. Judgement, not measured. */
export const MAX_LOG_FILE_BYTES = 1_000_000;
/** How many rotated files are kept next to the current one. */
export const LOG_BACKUP_COUNT = 2;

/**
 * The file operations the log file needs, so tests can use memory instead of a folder. All of them
 * are synchronous on purpose: the last line before a crash must be on disk before the app exits.
 */
export interface LogFileOperations {
  /** Create the folder and its parents; nothing happens when it exists. */
  makeFolder(path: string): void;
  /** The size of a file in bytes; 0 when it does not exist. */
  fileSize(path: string): number;
  /** Add text to the end of a file, creating it when missing. */
  append(path: string, text: string): void;
  /** Move a file over another; nothing happens when the source does not exist. */
  rename(from: string, to: string): void;
  /** Delete a file; nothing happens when it does not exist. */
  remove(path: string): void;
}

/** What `createRotatingFileWriter` needs. */
export interface RotatingFileOptions {
  /** The folder that holds the log files. */
  readonly folder: string;
  /** The file operations; `nodeLogFileOperations` in the app. */
  readonly files: LogFileOperations;
  /** The name of the current file; its rotated copies add `.1`, `.2`. Defaults to `folio.log`. */
  readonly fileName?: string;
  /** Rotate before a line would take the file past this size. */
  readonly maxBytes?: number;
  /** How many rotated files to keep. */
  readonly backups?: number;
}

/** The operations on the real file system. */
export const nodeLogFileOperations: LogFileOperations = {
  makeFolder: (path) => void mkdirSync(path, { recursive: true }),
  fileSize: (path) => {
    try {
      return statSync(path).size;
    } catch {
      return 0;
    }
  },
  append: (path, text) => {
    appendFileSync(path, text, 'utf8');
  },
  rename: (from, to) => {
    try {
      renameSync(from, to);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  },
  remove: (path) => {
    rmSync(path, { force: true });
  },
};

/**
 * Create a writer that appends lines to a log file (`folio.log` unless another name is given) and keeps the file from growing without
 * limit. When a line would take the file past the size limit, `folio.log` becomes `folio.log.1`,
 * `.1` becomes `.2`, and the oldest is deleted, so at most `(backups + 1) * maxBytes` stay on disk.
 * The writer throws when a file operation fails, so the logger can fall back, and it starts clean
 * on the next line.
 * @param options - The folder, the file operations and the limits.
 * @returns The writer, which takes one line without its newline.
 */
export function createRotatingFileWriter(options: RotatingFileOptions): (line: string) => void {
  const { folder, files } = options;
  const maxBytes = options.maxBytes ?? MAX_LOG_FILE_BYTES;
  const backups = options.backups ?? LOG_BACKUP_COUNT;
  const current = join(folder, options.fileName ?? 'folio.log');
  let size: number | undefined;
  let folderReady = false;

  const rotate = (): void => {
    files.remove(`${current}.${backups}`);
    for (let index = backups - 1; index >= 1; index -= 1) {
      files.rename(`${current}.${index}`, `${current}.${index + 1}`);
    }
    if (backups >= 1) {
      files.rename(current, `${current}.1`);
    } else {
      files.remove(current);
    }
  };

  return (line) => {
    try {
      const text = `${line}\n`;
      if (!folderReady) {
        files.makeFolder(folder);
        folderReady = true;
      }
      size ??= files.fileSize(current);
      const bytes = Buffer.byteLength(text, 'utf8');
      // A line that is larger than the limit still goes into a fresh file, never into a loop.
      if (size > 0 && size + bytes > maxBytes) {
        rotate();
        size = 0;
      }
      files.append(current, text);
      size += bytes;
    } catch (error) {
      // The state is unknown after a failure (the folder may be gone, the size is a guess), so the
      // next line looks again.
      size = undefined;
      folderReady = false;
      throw error;
    }
  };
}
