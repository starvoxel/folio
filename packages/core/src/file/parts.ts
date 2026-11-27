// ------------------------------
// parts.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { z } from 'zod';

import {
  accountsPartSchema,
  carriedJsonSchema,
  carriedLineSchema,
  categoriesPartSchema,
  settingsPartSchema,
} from './part-schemas.js';

/** The part kinds: one JSON value, or one JSON record per line. */
export type PartKind = 'json' | 'jsonl';

/** What the registry knows about one part. */
export interface PartSpec {
  readonly name: string;
  readonly kind: PartKind;
  /** The file inside the zip. */
  readonly fileName: string;
  /** For `json` the schema of the whole value; for `jsonl` the schema of each line. */
  readonly schema: z.ZodType;
  /** True while the plan that owns the part has not landed; its content is carried, not read. */
  readonly carried: boolean;
  /** The content of a part nobody has written to yet. */
  readonly empty: unknown;
}

/**
 * The only list of parts (AD-2). Encode, decode, the manifest and the fixtures all walk it, in this
 * order, so a later plan adds a part, or gives a carried one a real schema, in one place.
 */
export const PART_REGISTRY: readonly PartSpec[] = [
  {
    name: 'settings',
    kind: 'json',
    fileName: 'settings.json',
    schema: settingsPartSchema,
    carried: false,
    empty: {},
  },
  {
    name: 'accounts',
    kind: 'json',
    fileName: 'accounts.json',
    schema: accountsPartSchema,
    carried: false,
    empty: [],
  },
  {
    name: 'categories',
    kind: 'json',
    fileName: 'categories.json',
    schema: categoriesPartSchema,
    carried: false,
    empty: [],
  },
  {
    name: 'transactions',
    kind: 'jsonl',
    fileName: 'transactions.jsonl',
    schema: carriedLineSchema,
    carried: true,
    empty: [],
  },
  {
    name: 'rules',
    kind: 'json',
    fileName: 'rules.json',
    schema: carriedJsonSchema,
    carried: true,
    empty: [],
  },
  {
    name: 'months',
    kind: 'json',
    fileName: 'months.json',
    schema: carriedJsonSchema,
    carried: true,
    empty: [],
  },
  {
    name: 'networth',
    kind: 'json',
    fileName: 'networth.json',
    schema: carriedJsonSchema,
    carried: true,
    empty: [],
  },
  {
    name: 'audit',
    kind: 'jsonl',
    fileName: 'audit.jsonl',
    schema: carriedLineSchema,
    carried: true,
    empty: [],
  },
];
