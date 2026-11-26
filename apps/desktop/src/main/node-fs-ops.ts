// ------------------------------
// node-fs-ops.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mkdir, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises';

import type { FsOps } from './fs-ops.js';

/**
 * @param error - A thrown value.
 * @param code - A Node error code such as `ENOENT`.
 * @returns True when the error carries that code.
 */
function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}

/** The real file system. */
export const nodeFsOps: FsOps = {
  stat: async (path) => {
    try {
      const found = await stat(path);
      return { mtimeMs: found.mtimeMs, size: found.size };
    } catch (error) {
      if (hasCode(error, 'ENOENT')) {
        return null;
      }
      throw error;
    }
  },
  readFile: async (path) => new Uint8Array(await readFile(path)),
  readText: async (path) => {
    try {
      return await readFile(path, 'utf8');
    } catch (error) {
      if (hasCode(error, 'ENOENT')) {
        return null;
      }
      throw error;
    }
  },
  writeFileSynced: async (path, bytes) => {
    const handle = await open(path, 'w');
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  createExclusive: async (path, text) => {
    try {
      const handle = await open(path, 'wx');
      try {
        await handle.writeFile(text, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      return true;
    } catch (error) {
      if (hasCode(error, 'EEXIST')) {
        return false;
      }
      throw error;
    }
  },
  rename: (from, to) => rename(from, to),
  remove: (path) => rm(path, { force: true }),
  syncDirectory: async (path) => {
    // Windows cannot open a folder for flushing; its rename is already durable enough for our use.
    if (process.platform === 'win32') {
      return;
    }
    const handle = await open(path, 'r');
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  },
  makeDirectory: async (path) => {
    await mkdir(path, { recursive: true });
  },
  listDirectory: async (path) => {
    try {
      return await readdir(path);
    } catch (error) {
      if (hasCode(error, 'ENOENT')) {
        return [];
      }
      throw error;
    }
  },
};
