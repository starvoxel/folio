// ------------------------------
// change-set.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { YearMonth } from '../domain/local-date.js';
import type { Account } from '../budget/account.js';
import type { BudgetModel } from '../budget/model.js';
import type { Category } from '../budget/category.js';

/** An entity and its position in its list, so an undo puts it back where it was. */
export interface Placed<T> {
  readonly index: number;
  readonly value: T;
}

/** What one entity looked like before and after a change; null means it did not exist. */
export interface EntityChange<T> {
  readonly before: Placed<T> | null;
  readonly after: Placed<T> | null;
}

/** One part of a change set. Accounts and categories are global (AD-5); months arrive later. */
export type ChangePart =
  | ({ readonly kind: 'account'; readonly scope: 'global' } & EntityChange<Account>)
  | ({ readonly kind: 'category'; readonly scope: 'global' } & EntityChange<Category>);

/** What one command did: its parts, and the months it touches for the lock guard (AD-4). */
export interface ChangeSet {
  readonly parts: readonly ChangePart[];
  readonly touchedMonths: readonly YearMonth[];
}

/**
 * Take an entity out of a list, then put a placed one in.
 * @param list - The list.
 * @param change - The before and after of one entity.
 * @returns A new list.
 */
function replaceIn<T extends { readonly id: string }>(
  list: readonly T[],
  change: EntityChange<T>,
): readonly T[] {
  const without =
    change.before === null ? list : list.filter((item) => item.id !== change.before?.value.id);
  if (change.after === null) {
    return without;
  }
  return [
    ...without.slice(0, change.after.index),
    change.after.value,
    ...without.slice(change.after.index),
  ];
}

/**
 * Apply a change set to a model. It does not check anything; `applyCommand` does that first.
 * @param model - The model.
 * @param changeSet - The change set.
 * @returns The new model.
 */
export function applyChangeSet(model: BudgetModel, changeSet: ChangeSet): BudgetModel {
  let next = model;
  for (const part of changeSet.parts) {
    next =
      part.kind === 'account'
        ? { ...next, accounts: replaceIn(next.accounts, part) }
        : { ...next, categories: replaceIn(next.categories, part) };
  }
  return next;
}

/**
 * Build the change set that undoes another (AD-5): each part swapped, last part first.
 * @param changeSet - The change set to undo.
 * @returns Its inverse.
 */
export function invertChangeSet(changeSet: ChangeSet): ChangeSet {
  const parts = changeSet.parts.map((part): ChangePart =>
    part.kind === 'account'
      ? { ...part, before: part.after, after: part.before }
      : { ...part, before: part.after, after: part.before },
  );
  return { touchedMonths: changeSet.touchedMonths, parts: parts.reverse() };
}
