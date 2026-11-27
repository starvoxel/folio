// ------------------------------
// part-schemas.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { z } from 'zod';

import { ACCOUNT_TYPES } from '../budget/account.js';
import { idSchema, localDateSchema } from '../support/schema.js';

const accountId = idSchema<'Account'>();
const categoryId = idSchema<'Category'>();

const archivePeriodSchema = z.object({
  archivedFrom: localDateSchema,
  unarchivedOn: localDateSchema.nullable(),
});

/** The `accounts` part: a list of accounts. */
export const accountsPartSchema = z.array(
  z.object({
    id: accountId,
    name: z.string(),
    type: z.enum(ACCOUNT_TYPES),
    provider: z.string().nullable(),
    includeInAnalysis: z.boolean(),
    transferTreatment: z.enum(['notApplicable', 'savings', 'spending']),
    archivePeriods: z.array(archivePeriodSchema),
  }),
);

/** The `categories` part: a flat list, each with its parent or null. */
export const categoriesPartSchema = z.array(
  z.object({ id: categoryId, name: z.string(), parentId: categoryId.nullable() }),
);

/** The `settings` part: household settings and where setup stands. */
export const settingsPartSchema = z.object({
  name: z.string(),
  createdOn: localDateSchema,
  setup: z.object({ completedSteps: z.array(z.enum(['accounts', 'categories', 'import'])) }),
});

/** A part whose owning plan has not landed: any list, carried through unread. */
export const carriedJsonSchema = z.array(z.unknown());

/** One line of a JSONL part whose owning plan has not landed: any object. */
export const carriedLineSchema = z.record(z.string(), z.unknown());
