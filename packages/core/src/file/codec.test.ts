// ------------------------------
// codec.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import fc from 'fast-check';
import { strToU8 } from 'fflate';
import { describe, expect, it } from 'vitest';

import { applyCommand } from '../commands/apply-command.js';
import type { Command } from '../commands/command.js';
import { createBudget, type BudgetModel } from '../budget/model.js';
import { fixedClock } from '../domain/clock.js';
import { id } from '../domain/id.js';
import { localDate } from '../domain/local-date.js';
import { decodeFolio, encodeFolio } from './codec.js';
import { PART_REGISTRY } from './parts.js';
import { testDigest } from './test-digest.js';
import { entryText, unzipEntries, zipEntries } from './zip-bytes.js';
import type { DecodeFailure } from './failures.js';

const digest = testDigest;
const accountId = (n: number): ReturnType<typeof id<'Account'>> =>
  id<'Account'>(`aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`);
const categoryId = (n: number): ReturnType<typeof id<'Category'>> =>
  id<'Category'>(`cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`);
const context = { lockedMonths: [], accountHasTransactions: (): boolean => false };

/**
 * @param model - The starting model.
 * @param commands - Commands to apply; a refused one is skipped.
 * @returns The resulting model.
 */
function build(model: BudgetModel, commands: readonly Command[]): BudgetModel {
  let current = model;
  for (const command of commands) {
    const result = applyCommand(current, command, context);
    current = result.ok ? result.value.model : current;
  }
  return current;
}

const empty = createBudget('Household 2027', fixedClock(localDate('2026-11-27')));
const household = build(empty, [
  { kind: 'addAccount', id: accountId(1), name: 'Everyday', type: 'chequing' },
  { kind: 'addAccount', id: accountId(2), name: 'Visa', type: 'creditCard', provider: 'RBC' },
  { kind: 'addAccount', id: accountId(3), name: 'TFSA', type: 'tfsa' },
  { kind: 'archiveAccount', id: accountId(3), on: localDate('2026-05-10') },
  { kind: 'addCategory', id: categoryId(1), name: 'Food', parentId: null },
  { kind: 'addCategory', id: categoryId(2), name: 'Groceries', parentId: categoryId(1) },
]);

/**
 * Make a valid file, change some of its parts, and fix the checksums, so a test can reach the
 * checks behind the checksum. A new `manifest.json` is written as given.
 * @param bytes - A valid file.
 * @param changes - New text by file name; `null` removes the file.
 * @returns The forged file.
 */
async function forge(
  bytes: Uint8Array,
  changes: Readonly<Record<string, string | null>>,
): Promise<Uint8Array> {
  const unzipped = unzipEntries(bytes);
  if (!unzipped.ok) {
    throw new Error('Not a zip');
  }
  const texts = new Map([...unzipped.value].map(([name, data]) => [name, entryText(data)]));
  for (const [name, text] of Object.entries(changes)) {
    if (text === null) {
      texts.delete(name);
    } else {
      texts.set(name, text);
    }
  }
  if (!('manifest.json' in changes)) {
    const manifest = JSON.parse(texts.get('manifest.json') ?? '{}') as {
      parts: { file: string; sha256: string }[];
    };
    for (const part of manifest.parts) {
      const text = texts.get(part.file);
      if (text !== undefined) {
        part.sha256 = await digest(strToU8(text));
      }
    }
    texts.set('manifest.json', JSON.stringify(manifest));
  }
  return zipEntries([...texts].map(([name, text]) => ({ name, text })));
}

/**
 * @param bytes - A file.
 * @returns The failure from opening it; the test fails if it opened.
 */
async function failureOf(bytes: Uint8Array): Promise<DecodeFailure> {
  const result = await decodeFolio(bytes, { digest });
  if (result.ok) {
    throw new Error('Expected a failure');
  }
  return result.error;
}

describe('encodeFolio', () => {
  describe('theSameModelTwice', () => {
    it('givesIdenticalBytes', async () => {
      expect(await encodeFolio(household, { digest })).toEqual(
        await encodeFolio(household, { digest }),
      );
    });
  });

  describe('aFileThatWasDecoded', () => {
    it('encodesBackToTheSameBytes', async () => {
      const bytes = await encodeFolio(household, { digest, appVersion: '0.0.0' });
      const decoded = await decodeFolio(bytes, { digest });
      expect(decoded.ok).toBe(true);
      if (decoded.ok) {
        const again = await encodeFolio(decoded.value.model, {
          digest,
          appVersion: '0.0.0',
          carried: decoded.value.carried,
        });
        expect(again).toEqual(bytes);
      }
    });
  });

  describe('theNewFile', () => {
    it('hasTheManifestSummaryAndEveryPartInRegistryOrder', async () => {
      const unzipped = unzipEntries(await encodeFolio(household, { digest }));
      expect(unzipped.ok && [...unzipped.value.keys()]).toEqual([
        'manifest.json',
        'summary.json',
        ...PART_REGISTRY.map((part) => part.fileName),
      ]);
    });

    it('writesASummaryTheStartScreenCanRead', async () => {
      const unzipped = unzipEntries(await encodeFolio(household, { digest }));
      const summary = unzipped.ok
        ? entryText(unzipped.value.get('summary.json') ?? new Uint8Array())
        : '';
      expect(JSON.parse(summary)).toEqual({
        accountCount: 3,
        lastClosedMonth: null,
        name: 'Household 2027',
        openMonth: '2026-11',
      });
    });
  });

  describe('aCarriedPartThatDoesNotFit', () => {
    it('throwsBecauseItIsABug', async () => {
      await expect(
        encodeFolio(household, { digest, carried: { transactions: [42] } }),
      ).rejects.toThrow(RangeError);
    });
  });
});

describe('decodeFolio', () => {
  describe('aFileMadeByEncode', () => {
    it('returnsTheSameModel', async () => {
      const decoded = await decodeFolio(await encodeFolio(household, { digest }), { digest });
      expect(decoded).toMatchObject({ ok: true, value: { model: household, damagedLines: [] } });
    });
  });

  describe('anyModelMadeOfCommands', () => {
    it('survivesEncodeThenDecode', async () => {
      const names = fc.constantFrom('A', 'Ünïcode ✓', 'with "quotes"', 'line\nbreak', '  spaced');
      const anyCommand: fc.Arbitrary<Command> = fc.oneof(
        fc.record({
          kind: fc.constant('addAccount' as const),
          id: fc.integer({ min: 1, max: 5 }).map(accountId),
          name: names,
          type: fc.constantFrom('chequing', 'creditCard', 'rrsp', 'mortgage'),
        }),
        fc.record({
          kind: fc.constant('archiveAccount' as const),
          id: fc.integer({ min: 1, max: 5 }).map(accountId),
          on: fc.constantFrom(localDate('2026-02-03'), localDate('2026-09-30')),
        }),
        fc.record({
          kind: fc.constant('addCategory' as const),
          id: fc.integer({ min: 1, max: 5 }).map(categoryId),
          name: names,
          parentId: fc.oneof(fc.constant(null), fc.integer({ min: 1, max: 5 }).map(categoryId)),
        }),
      );
      await fc.assert(
        fc.asyncProperty(fc.array(anyCommand, { maxLength: 15 }), async (commands) => {
          const model = build(empty, commands);
          const decoded = await decodeFolio(await encodeFolio(model, { digest }), { digest });
          expect(decoded.ok && decoded.value.model).toEqual(model);
        }),
        { numRuns: 40 },
      );
    });
  });

  describe('carriedParts', () => {
    it('comeBackAsTheyWentIn', async () => {
      const carried = {
        transactions: [{ a: 1 }, { b: [2, 3] }],
        rules: [{ r: true }],
        audit: [{ at: 'x' }],
      };
      const decoded = await decodeFolio(await encodeFolio(household, { digest, carried }), {
        digest,
      });
      expect(decoded.ok && decoded.value.carried).toEqual({
        transactions: carried.transactions,
        rules: carried.rules,
        months: [],
        networth: [],
        audit: carried.audit,
      });
    });
  });

  describe('bytesThatAreNotAZip', () => {
    it('failsWithNotAZip', async () => {
      expect(await failureOf(new Uint8Array([9, 9, 9]))).toEqual({ code: 'notAZip' });
    });
  });

  describe('aTruncatedFile', () => {
    it('failsWithoutThrowing', async () => {
      const bytes = await encodeFolio(household, { digest });
      expect(await failureOf(bytes.slice(0, bytes.length - 40))).toEqual({ code: 'notAZip' });
    });
  });

  describe('aFlippedByteAnywhere', () => {
    it('neverOpensAsIfNothingHappenedAndNeverThrows', async () => {
      const bytes = await encodeFolio(household, { digest });
      const original = await decodeFolio(bytes, { digest });
      for (let at = 0; at < bytes.length; at += 7) {
        const damaged = bytes.slice();
        damaged[at] = (damaged[at] ?? 0) ^ 0xff;
        const result = await decodeFolio(damaged, { digest });
        expect(result.ok ? result : null).toEqual(result.ok ? original : null);
      }
    });
  });

  describe('aZipWithNoManifest', () => {
    it('failsWithManifestMissing', async () => {
      const bytes = await forge(await encodeFolio(household, { digest }), {
        'manifest.json': null,
      });
      expect(await failureOf(bytes)).toEqual({ code: 'manifestMissing' });
    });
  });

  describe('aManifestThatIsNotAManifest', () => {
    it('failsWithManifestInvalid', async () => {
      const valid = await encodeFolio(household, { digest });
      for (const text of [
        'not json',
        '{}',
        '[]',
        'null',
        '{"format":"folio","formatVersion":0,"parts":[]}',
      ]) {
        expect(await failureOf(await forge(valid, { 'manifest.json': text }))).toEqual({
          code: 'manifestInvalid',
        });
      }
    });
  });

  describe('aMissingPart', () => {
    it('failsWithPartMissingNamingIt', async () => {
      const bytes = await forge(await encodeFolio(household, { digest }), {
        'accounts.json': null,
      });
      expect(await failureOf(bytes)).toEqual({ code: 'partMissing', part: 'accounts' });
    });
  });

  describe('aPartChangedAfterTheChecksum', () => {
    it('failsWithChecksumMismatchNamingIt', async () => {
      const valid = await encodeFolio(household, { digest });
      const unzipped = unzipEntries(valid);
      const entries = unzipped.ok
        ? [...unzipped.value].map(([name, data]) => ({
            name,
            text:
              name === 'accounts.json'
                ? entryText(data).replace('Everyday', 'Everydax')
                : entryText(data),
          }))
        : [];
      expect(await failureOf(zipEntries(entries))).toEqual({
        code: 'checksumMismatch',
        part: 'accounts',
      });
    });
  });

  describe('aPartThatDoesNotFitItsSchema', () => {
    it('failsWithSchemaInvalidNamingThePartAndPathButNoValue', async () => {
      const valid = await encodeFolio(household, { digest });
      const bad = JSON.stringify([{ id: 'SecretMerchant', name: 'SecretName', type: 'nope' }]);
      const failure = await failureOf(await forge(valid, { 'accounts.json': bad }));
      expect(failure).toMatchObject({ code: 'schemaInvalid', part: 'accounts' });
      expect(JSON.stringify(failure)).not.toMatch(/Secret/u);
    });

    it('failsForJsonThatIsNotJson', async () => {
      const valid = await encodeFolio(household, { digest });
      expect(await failureOf(await forge(valid, { 'settings.json': '{oops' }))).toMatchObject({
        code: 'schemaInvalid',
        part: 'settings',
      });
    });
  });

  describe('aFileThatBreaksARuleNoSchemaChecks', () => {
    it('failsForDuplicateIdsAndAMissingIncome', async () => {
      const valid = await encodeFolio(household, { digest });
      const account = household.accounts[0];
      const duplicated = JSON.stringify([account, account]);
      expect(await failureOf(await forge(valid, { 'accounts.json': duplicated }))).toMatchObject({
        code: 'schemaInvalid',
        part: 'accounts',
      });
      expect(await failureOf(await forge(valid, { 'categories.json': '[]' }))).toMatchObject({
        code: 'schemaInvalid',
        part: 'categories',
      });
    });
  });

  describe('aFormatNewerThanThisCode', () => {
    it('isRefusedAsNewerFormatEvenIfTheRestIsUnreadable', async () => {
      const valid = await encodeFolio(household, { digest });
      const text = JSON.stringify({ formatVersion: 2, parts: 'unknown shape' });
      expect(await failureOf(await forge(valid, { 'manifest.json': text }))).toEqual({
        code: 'newerFormat',
        formatVersion: 2,
      });
    });
  });

  describe('aDamagedJsonlLine', () => {
    it('losesOnlyThatRecordAndReportsItsLine', async () => {
      const valid = await encodeFolio(household, { digest });
      const audit = '{"a":1}\n{"b": broken\n\n{"c":3}\n[1,2]\n';
      const decoded = await decodeFolio(await forge(valid, { 'audit.jsonl': audit }), { digest });
      expect(decoded.ok && decoded.value.carried['audit']).toEqual([{ a: 1 }, { c: 3 }]);
      expect(decoded.ok && decoded.value.damagedLines).toEqual([
        { part: 'audit', line: 2 },
        { part: 'audit', line: 5 },
      ]);
      expect(decoded.ok && decoded.value.model).toEqual(household);
    });
  });
});
