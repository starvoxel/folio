// ------------------------------
// model.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Clock } from '../domain/clock.js';
import type { LocalDate } from '../domain/local-date.js';
import type { Account } from './account.js';
import { INCOME_CATEGORY_ID, INCOME_CATEGORY_NAME, type Category } from './category.js';

/** The steps of the setup dialog, in order. */
export type SetupStep = 'accounts' | 'categories' | 'import';

/** Where setup stands, so unfinished steps can be reached from their normal screens (S1.11). */
export interface SetupState {
  readonly completedSteps: readonly SetupStep[];
}

/** Household-level settings that live in the file (AD-11). */
export interface HouseholdSettings {
  readonly name: string;
  readonly createdOn: LocalDate;
  readonly setup: SetupState;
}

/** The budget held in memory (AD-1); every edit goes through a command (AD-4). */
export interface BudgetModel {
  readonly settings: HouseholdSettings;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
}

/**
 * Make the model a new file starts with: no accounts, only the Income category.
 * @param name - The budget name.
 * @param clock - Supplies the creation date.
 * @returns The new model.
 */
export function createBudget(name: string, clock: Clock): BudgetModel {
  return {
    settings: { name, createdOn: clock.today(), setup: { completedSteps: [] } },
    accounts: [],
    categories: [{ id: INCOME_CATEGORY_ID, name: INCOME_CATEGORY_NAME, parentId: null }],
  };
}
