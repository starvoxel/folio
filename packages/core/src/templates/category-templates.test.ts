// ------------------------------
// category-templates.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { INCOME_CATEGORY_ID } from '../budget/category.js';
import { createBudget } from '../budget/model.js';
import { applyCommand } from '../commands/apply-command.js';
import { COMMAND_KIND } from '../commands/command.js';
import { fixedClock } from '../domain/clock.js';
import { localDate } from '../domain/local-date.js';
import { checkModel } from '../file/model-checks.js';
import { CATEGORY_TEMPLATES, instantiateTemplate, TEMPLATE_IDS } from './category-templates.js';

/**
 * @returns A source of distinct UUIDs.
 */
function counter(): () => string {
  let n = 0;
  return () => `bbbbbbbb-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
}

describe('CATEGORY_TEMPLATES', () => {
  describe('everyTemplate', () => {
    it('startsWithIncomeAndHasFeesAndInterest', () => {
      for (const id of TEMPLATE_IDS) {
        const categories = CATEGORY_TEMPLATES[id].categories;
        expect(categories[0]?.name).toBe('Income');
        const fees = categories.find((category) => category.name === 'Fees & interest');
        expect(fees?.children).toEqual(['Interest charges', 'Bank fees']);
      }
    });

    it('hasNoEmptyOrRepeatedNamesAmongSiblings', () => {
      for (const id of TEMPLATE_IDS) {
        const mains = CATEGORY_TEMPLATES[id].categories;
        expect(new Set(mains.map((main) => main.name)).size).toBe(mains.length);
        for (const main of mains) {
          expect(main.children.every((name) => name.trim() !== '')).toBe(true);
          expect(new Set(main.children).size).toBe(main.children.length);
        }
      }
    });
  });

  describe('theDetailedTemplate', () => {
    it('hasEverythingInSimpleAndChildrenAndPets', () => {
      const detailed = CATEGORY_TEMPLATES.detailed.categories.map((main) => main.name);
      for (const main of CATEGORY_TEMPLATES.simple.categories) {
        expect(detailed).toContain(main.name);
      }
      expect(detailed).toEqual(expect.arrayContaining(['Children', 'Pets']));
    });
  });
});

describe('instantiateTemplate', () => {
  describe('everyTemplate', () => {
    it('givesValidCategoriesWithIncomeKeepingItsFixedId', () => {
      for (const template of TEMPLATE_IDS) {
        const categories = instantiateTemplate(template, counter());
        const model = {
          ...createBudget('x', fixedClock(localDate('2026-11-28'))),
          categories,
        };
        expect([...checkModel(model)]).toEqual([]);
        expect(categories[0]?.id).toBe(INCOME_CATEGORY_ID);
        expect(new Set(categories.map((category) => category.id)).size).toBe(categories.length);
      }
    });
  });
});

describe('applyTemplate', () => {
  describe('anEveryTemplateOnANewBudget', () => {
    it('replacesTheCategoriesWithTheTemplate', () => {
      for (const template of TEMPLATE_IDS) {
        const empty = createBudget('x', fixedClock(localDate('2026-11-28')));
        const categories = instantiateTemplate(template, counter());
        const result = applyCommand(
          empty,
          { kind: COMMAND_KIND.applyTemplate, categories },
          { lockedMonths: [], accountHasTransactions: () => false },
        );
        expect(result.ok && result.value.model.categories).toEqual(categories);
      }
    });
  });
});
