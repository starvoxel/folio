// ------------------------------
// test-digest.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Digest } from './digest.js';

// `core` has no DOM or Node typings, so the one global the host also uses is declared here.
declare const crypto: {
  readonly subtle: {
    digest(algorithm: 'SHA-256', data: Uint8Array): Promise<ArrayBuffer>;
  };
};

/**
 * The digest tests pass: the same `crypto.subtle` call the host makes.
 * @param data - The bytes to hash.
 * @returns The SHA-256 as lower-case hexadecimal.
 */
export const testDigest: Digest = async (data) => {
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
};
