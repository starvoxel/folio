// ------------------------------
// app-files.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { resolve, sep } from 'node:path';

/**
 * Work out which file inside a directory a request path names.
 * @param root - The directory the app is served from.
 * @param pathname - The URL path of the request.
 * @returns The absolute file path, or null when the path would leave the directory.
 */
export function resolveAppFile(root: string, pathname: string): string | null {
  const base = resolve(root);
  let relative: string;
  try {
    relative = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const requested = relative === '/' || relative === '' ? '/index.html' : relative;
  const full = resolve(base, `.${requested}`);
  return full === base || full.startsWith(base + sep) ? full : null;
}
