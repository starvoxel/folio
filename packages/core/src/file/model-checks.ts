// ------------------------------
// model-checks.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { BudgetModel } from '../budget/model.js';
import { INCOME_CATEGORY_ID } from '../budget/category.js';
import type { ValidationIssue } from '../support/schema.js';

/**
 * Check what a schema cannot: ids are unique, every subcategory has a main parent, Income exists
 * and archive periods are in order. A file that breaks them was not written by Folio.
 * @param model - A model whose parts each passed their schema.
 * @returns Where it breaks a rule, with the part and position and no value; empty when sound.
 */
export function checkModel(model: BudgetModel): Map<string, ValidationIssue[]> {
  const issues = new Map<string, ValidationIssue[]>();
  const add = (part: string, path: string, message: string): void => {
    issues.set(part, [...(issues.get(part) ?? []), { path, message }]);
  };
  const seenAccounts = new Set<string>();
  model.accounts.forEach((account, index) => {
    if (seenAccounts.has(account.id)) {
      add('accounts', String(index), 'Duplicate id');
    }
    seenAccounts.add(account.id);
    account.archivePeriods.forEach((period, at) => {
      const open = period.unarchivedOn === null;
      if (
        (open && at !== account.archivePeriods.length - 1) ||
        (!open && period.unarchivedOn < period.archivedFrom)
      ) {
        add('accounts', `${index}.archivePeriods.${at}`, 'Archive periods out of order');
      }
    });
  });
  const mains = new Set(model.categories.filter((c) => c.parentId === null).map((c) => c.id));
  const seenCategories = new Set<string>();
  model.categories.forEach((category, index) => {
    if (seenCategories.has(category.id)) {
      add('categories', String(index), 'Duplicate id');
    }
    seenCategories.add(category.id);
    if (category.parentId !== null && !mains.has(category.parentId)) {
      add('categories', `${index}.parentId`, 'Parent is not a main category');
    }
  });
  if (!mains.has(INCOME_CATEGORY_ID)) {
    add('categories', '', 'Income is missing');
  }
  return issues;
}
