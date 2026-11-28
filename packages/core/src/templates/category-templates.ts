// ------------------------------
// category-templates.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { INCOME_CATEGORY_ID, type Category } from '../budget/category.js';
import { newId, type IdSource } from '../domain/id.js';

/** The two starter sets (S1.6). */
export const TEMPLATE_IDS = ['simple', 'detailed'] as const;

/** One of the starter sets. */
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/** A main category and its subcategories, as bundled data. */
export interface TemplateCategory {
  readonly name: string;
  readonly children: readonly string[];
}

/** A starter set: what the person is shown and the categories it holds. */
export interface CategoryTemplate {
  readonly title: string;
  readonly description: string;
  /** Income comes first and is the one that cannot be removed (S1.7). */
  readonly categories: readonly TemplateCategory[];
}

/**
 * The bundled templates. A template is only a starting set: setup shows its categories to be
 * switched off, renamed, added to or removed before they are applied (S1.7). Fees & interest is in
 * both for the card-side meaning of "interest" (C1.15).
 */
export const CATEGORY_TEMPLATES: Readonly<Record<TemplateId, CategoryTemplate>> = {
  simple: {
    title: 'Simple',
    description: 'A few broad categories to start with.',
    categories: [
      { name: 'Income', children: ['Pay', 'Other income'] },
      { name: 'Housing', children: [] },
      { name: 'Food', children: ['Groceries', 'Restaurants'] },
      { name: 'Transport', children: [] },
      { name: 'Health', children: [] },
      { name: 'Fun and gifts', children: [] },
      { name: 'Fees & interest', children: ['Interest charges', 'Bank fees'] },
      { name: 'Other', children: [] },
    ],
  },
  detailed: {
    title: 'Detailed household',
    description: 'More categories and subcategories for a family.',
    categories: [
      {
        name: 'Income',
        children: ['Pay', 'Bonus', 'Government benefits', 'Investment income', 'Other income'],
      },
      {
        name: 'Housing',
        children: [
          'Rent or mortgage',
          'Property tax',
          'Utilities',
          'Internet and phone',
          'Home insurance',
          'Repairs and maintenance',
        ],
      },
      { name: 'Food', children: ['Groceries', 'Restaurants', 'Coffee and takeout'] },
      {
        name: 'Transport',
        children: ['Fuel', 'Transit', 'Car insurance', 'Car maintenance', 'Parking and tolls'],
      },
      { name: 'Health', children: ['Pharmacy', 'Medical and dental', 'Fitness'] },
      { name: 'Children', children: ['Childcare', 'School', 'Activities', 'Clothing'] },
      { name: 'Pets', children: ['Food and supplies', 'Vet'] },
      {
        name: 'Fun and gifts',
        children: ['Entertainment', 'Subscriptions', 'Hobbies', 'Travel', 'Gifts', 'Donations'],
      },
      { name: 'Fees & interest', children: ['Interest charges', 'Bank fees', 'Card annual fees'] },
      { name: 'Other', children: ['Taxes and government', 'Professional services'] },
    ],
  },
};

/**
 * Make the categories of a template with fresh ids, in display order: each main category, then
 * its subcategories. Income keeps its fixed id.
 * @param template - Which template.
 * @param ids - Supplies the ids.
 * @returns The categories, ready for `applyTemplate`.
 */
export function instantiateTemplate(template: TemplateId, ids: IdSource): readonly Category[] {
  const result: Category[] = [];
  for (const main of CATEGORY_TEMPLATES[template].categories) {
    const mainId = main.name === 'Income' ? INCOME_CATEGORY_ID : newId<'Category'>(ids);
    result.push({ id: mainId, name: main.name, parentId: null });
    for (const child of main.children) {
      result.push({ id: newId<'Category'>(ids), name: child, parentId: mainId });
    }
  }
  return result;
}
