// ------------------------------
// memory-fs.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { dirname } from 'node:path';

import type { FsOps } from './fs-ops.js';

/** An in-memory file system for unit tests, with a way to fail a chosen call. */
export interface MemoryFs extends FsOps {
  /** The text of every file, by path. */
  readonly files: Map<string, Uint8Array>;
  /** Make the next call of this operation throw once. */
  failNext(operation: keyof FsOps): void;
  /** Change a file as another program would, giving it a new time. */
  touch(path: string, bytes: Uint8Array): void;
}

/**
 * Make an empty in-memory file system. Times come from a counter, so runs are deterministic.
 * @returns The file system.
 */
export function createMemoryFs(): MemoryFs {
  const files = new Map<string, Uint8Array>();
  const times = new Map<string, number>();
  const failures = new Set<keyof FsOps>();
  let clock = 1000;
  const put = (path: string, bytes: Uint8Array): void => {
    clock += 1;
    files.set(path, bytes.slice());
    times.set(path, clock);
  };
  const maybeFail = (operation: keyof FsOps): void => {
    if (failures.delete(operation)) {
      throw new Error(`simulated ${operation} failure`);
    }
  };
  const encoder = new TextEncoder();
  return {
    files,
    failNext: (operation) => void failures.add(operation),
    touch: put,
    stat: (path) => {
      const bytes = files.get(path);
      const mtimeMs = times.get(path);
      return Promise.resolve(
        bytes === undefined || mtimeMs === undefined ? null : { mtimeMs, size: bytes.byteLength },
      );
    },
    readFile: (path) => {
      const bytes = files.get(path);
      return bytes === undefined
        ? Promise.reject(new Error('missing'))
        : Promise.resolve(bytes.slice());
    },
    readText: (path) => {
      const bytes = files.get(path);
      return Promise.resolve(bytes === undefined ? null : new TextDecoder().decode(bytes));
    },
    writeFileSynced: (path, bytes) => {
      maybeFail('writeFileSynced');
      put(path, bytes);
      return Promise.resolve();
    },
    createExclusive: (path, text) => {
      maybeFail('createExclusive');
      if (files.has(path)) {
        return Promise.resolve(false);
      }
      put(path, encoder.encode(text));
      return Promise.resolve(true);
    },
    rename: (from, to) => {
      maybeFail('rename');
      const bytes = files.get(from);
      if (bytes === undefined) {
        return Promise.reject(new Error('missing'));
      }
      files.delete(from);
      put(to, bytes);
      return Promise.resolve();
    },
    remove: (path) => {
      files.delete(path);
      return Promise.resolve();
    },
    syncDirectory: () => Promise.resolve(),
    makeDirectory: () => Promise.resolve(),
    listDirectory: (path) =>
      Promise.resolve(
        [...files.keys()]
          .filter((file) => dirname(file) === path)
          .map((file) => file.slice(path.length + 1)),
      ),
  };
}
