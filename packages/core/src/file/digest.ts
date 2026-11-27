// ------------------------------
// digest.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Computes the SHA-256 of some bytes as lower-case hexadecimal. The caller supplies it, as with
 * `Clock` and `IdSource`: the host passes `crypto.subtle`, tests pass Node's, and `core` writes no
 * hash of its own and needs neither Node nor the DOM types.
 */
export type Digest = (data: Uint8Array) => Promise<string>;
