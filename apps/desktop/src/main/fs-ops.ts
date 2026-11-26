// ------------------------------
// fs-ops.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** What the file system reports about a file. */
export interface FsStat {
  readonly mtimeMs: number;
  readonly size: number;
}

/** The file-system calls the host needs, so the logic around them can be tested without a disk. */
export interface FsOps {
  /** The modification time and size, or null when the path does not exist. */
  stat(path: string): Promise<FsStat | null>;
  readFile(path: string): Promise<Uint8Array>;
  /** The text of a file, or null when it does not exist. */
  readText(path: string): Promise<string | null>;
  /** Create or truncate a file, write it, flush it to disk and close it. */
  writeFileSynced(path: string, bytes: Uint8Array): Promise<void>;
  /** Create a file only if it does not exist yet; false when it already does. */
  createExclusive(path: string, text: string): Promise<boolean>;
  /** Move a file over another, replacing it in one step. */
  rename(from: string, to: string): Promise<void>;
  /** Delete a file; a missing file is not an error. */
  remove(path: string): Promise<void>;
  /** Flush a folder's entries to disk where the operating system allows it. */
  syncDirectory(path: string): Promise<void>;
  makeDirectory(path: string): Promise<void>;
  /** The names in a folder; empty when it does not exist. */
  listDirectory(path: string): Promise<string[]>;
}
