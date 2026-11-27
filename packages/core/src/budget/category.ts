// ------------------------------
// category.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Id } from '../domain/id.js';
import { id } from '../domain/id.js';

/** The id of the Income category, the same in every file so code and templates can name it. */
export const INCOME_CATEGORY_ID: Id<'Category'> = id('00000000-0000-4000-8000-000000000001');

/** A category; a main category has no parent and a subcategory has a main one (two levels). */
export interface Category {
  readonly id: Id<'Category'>;
  readonly name: string;
  readonly parentId: Id<'Category'> | null;
}

/** The name Income starts with; it can be renamed but never removed (S1.7). */
export const INCOME_CATEGORY_NAME = 'Income';
