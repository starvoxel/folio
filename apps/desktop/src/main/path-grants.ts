// ------------------------------
// path-grants.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { isAbsolute, resolve } from 'node:path';

/**
 * The files the person has chosen in this session. The renderer may name a file only if a native
 * dialog (or a drop) gave it to the main process first, so a compromised page cannot read or
 * write anywhere else (typescript_electron: IPC and the preload bridge).
 */
export interface PathGrants {
  /** Remember a path the person chose. */
  grant(path: string): void;
  /** Tell whether a path was chosen. */
  isGranted(path: string): boolean;
}

/**
 * Make an empty set of grants. Paths compare after `resolve`, and without regard to case on
 * Windows and macOS, whose usual file systems ignore it.
 * @param platform - The operating system, which decides case handling.
 * @returns The grants.
 */
export function createPathGrants(platform: NodeJS.Platform = process.platform): PathGrants {
  const granted = new Set<string>();
  const keyOf = (path: string): string | null => {
    if (path.includes('\0') || !isAbsolute(path)) {
      return null;
    }
    const resolved = resolve(path);
    return platform === 'win32' || platform === 'darwin' ? resolved.toLowerCase() : resolved;
  };
  return {
    grant: (path) => {
      const key = keyOf(path);
      if (key !== null) {
        granted.add(key);
      }
    },
    isGranted: (path) => {
      const key = keyOf(path);
      return key !== null && granted.has(key);
    },
  };
}
