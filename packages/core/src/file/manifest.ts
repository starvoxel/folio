// ------------------------------
// manifest.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { z } from 'zod';

/** The format version this code writes and reads without a migration. */
export const FORMAT_VERSION = 1;

/** One file the manifest vouches for. */
export const manifestPartSchema = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.enum(['json', 'jsonl']),
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
});

/** `manifest.json`: the version, the app that wrote it and a checksum per part (AD-2). */
export const manifestSchema = z.object({
  format: z.literal('folio'),
  formatVersion: z.number().int().min(1),
  appVersion: z.string().optional(),
  parts: z.array(manifestPartSchema),
});

/** A parsed manifest. */
export type Manifest = z.output<typeof manifestSchema>;
