// ------------------------------
// web-digest.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Digest } from '@folio/core';

/**
 * The SHA-256 of some bytes through the browser's own `crypto.subtle`, which the page has in
 * Electron and in every browser, so the format code needs no hash of its own.
 * @param data - The bytes.
 * @returns The digest as lower-case hexadecimal.
 */
export const webDigest: Digest = async (data) => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data.slice()));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
};
