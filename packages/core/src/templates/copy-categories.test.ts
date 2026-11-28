// ------------------------------
// copy-categories.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands/apply-command.js';
import { COMMAND_KIND } from '../commands/command.js';
import { createBudget, type BudgetModel } from '../budget/model.js';
import { fixedClock } from '../domain/clock.js';
import { id } from '../domain/id.js';
import { localDate } from '../domain/local-date.js';
import { encodeFolio } from '../file/codec.js';
import { testDigest } from '../file/test-digest.js';
import { zipEntries } from '../file/zip-bytes.js';
import { COPY_FROM_FILE_COPIES_RULES, categoriesFromFile } from './copy-categories.js';
import { instantiateTemplate } from './category-templates.js';

const digest = testDigest;

/**
 * @param start - Where the counter starts, so two sources never overlap.
 * @returns A source of distinct UUIDs.
 */
function counter(start: number): () => string {
  let n = start;
  return () => `dddddddd-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`;
}

/**
 * @returns A source file with accounts, a template and an archived account.
 */
function sourceModel(): BudgetModel {
  let model = createBudget('Source', fixedClock(localDate('2026-02-01')));
  const context = { lockedMonths: [], accountHasTransactions: () => false };
  const applied = applyCommand(
    model,
    {
      kind: COMMAND_KIND.applyTemplate,
      categories: instantiateTemplate('simple', counter(1000)),
    },
    context,
  );
  model = applied.ok ? applied.value.model : model;
  for (const [n, name] of ['Everyday', 'Visa'].entries()) {
    const added = applyCommand(
      model,
      {
        kind: COMMAND_KIND.addAccount,
        id: id<'Account'>(`aaaaaaaa-0000-4000-8000-00000000000${String(n)}`),
        name,
        type: 'chequing',
      },
      context,
    );
    model = added.ok ? added.value.model : model;
  }
  return model;
}

describe('categoriesFromFile', () => {
  describe('aValidFile', () => {
    it('givesItsCategoriesWithFreshIdsAndTheSameShape', async () => {
      const source = sourceModel();
      const bytes = await encodeFolio(source, { digest });
      const copied = await categoriesFromFile(bytes, { digest, ids: counter(5000) });
      expect(copied.ok).toBe(true);
      if (copied.ok) {
        expect(copied.value.map((category) => category.name)).toEqual(
          source.categories.map((category) => category.name),
        );
        const oldIds = new Set(source.categories.map((category) => category.id));
        const fresh = copied.value.filter((category) => category.name !== 'Income');
        expect(fresh.every((category) => !oldIds.has(category.id))).toBe(true);
        expect(copied.value[0]?.parentId).toBeNull();
      }
    });

    it('givesOnlyCategoriesNeverAccountsOrAnythingElse', async () => {
      const bytes = await encodeFolio(sourceModel(), { digest });
      const copied = await categoriesFromFile(bytes, { digest, ids: counter(5000) });
      const text = JSON.stringify(copied);
      expect(text).not.toContain('Everyday');
      expect(text).not.toContain('Visa');
      expect(text).not.toContain('archivePeriods');
    });

    it('canBeAppliedToANewBudget', async () => {
      const bytes = await encodeFolio(sourceModel(), { digest });
      const copied = await categoriesFromFile(bytes, { digest, ids: counter(5000) });
      const target = createBudget('Target', fixedClock(localDate('2026-11-28')));
      const applied = copied.ok
        ? applyCommand(
            target,
            { kind: COMMAND_KIND.applyTemplate, categories: copied.value },
            { lockedMonths: [], accountHasTransactions: () => false },
          )
        : null;
      expect(applied?.ok && applied.value.model.categories).toEqual(
        copied.ok ? copied.value : null,
      );
      expect(applied?.ok && applied.value.model.accounts).toEqual([]);
    });
  });

  describe('aDamagedFile', () => {
    it('failsWithTheCodecsFailureAndGivesNothing', async () => {
      const bytes = await encodeFolio(sourceModel(), { digest });
      const damaged = bytes.slice(0, bytes.length - 40);
      expect(await categoriesFromFile(damaged, { digest, ids: counter(5000) })).toEqual({
        ok: false,
        error: { code: 'notAZip' },
      });
    });
  });

  describe('aFileFromANewerFormat', () => {
    it('failsWithNewerFormat', async () => {
      const newer = zipEntries([
        { name: 'manifest.json', text: JSON.stringify({ formatVersion: 2, parts: [] }) },
      ]);
      expect(await categoriesFromFile(newer, { digest, ids: counter(5000) })).toEqual({
        ok: false,
        error: { code: 'newerFormat', formatVersion: 2 },
      });
    });
  });

  describe('theRulesFlag', () => {
    it('saysRulesAreNotCopiedYet', () => {
      expect(COPY_FROM_FILE_COPIES_RULES).toBe(false);
    });
  });
});
