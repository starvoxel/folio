// ------------------------------
// stable-json.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Re-make a value with every object's keys in sorted order, so the same data always writes the
 * same text.
 * @param _key - The key being visited.
 * @param value - The value being visited.
 * @returns The value, with plain objects rebuilt in key order.
 */
function sortKeys(_key: string, value: unknown): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.fromEntries(
      Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  return value;
}

/**
 * Write a value as JSON with sorted keys (AD-2 determinism).
 * @param value - The value.
 * @param indent - Spaces per level; 0 writes it on one line.
 * @returns The JSON text.
 */
export function stableStringify(value: unknown, indent: number): string {
  return JSON.stringify(value, sortKeys, indent);
}
