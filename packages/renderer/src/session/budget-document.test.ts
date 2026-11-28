// ------------------------------
// budget-document.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { COMMAND_KIND, FAILURE, fixedClock, id, localDate, money } from '@folio/core';
import { createHostFileStore, createMockHost, type FileRef } from '@folio/host-api';

import { createBudgetDocument } from './budget-document.js';
import { createFileSession } from './file-session.js';
import { webDigest } from './web-digest.js';

const where: FileRef = { path: '/data/Household 2027.folio', name: 'Household 2027.folio' };
// Typed by its use, so it fits the command context before and after the category check exists.
const context = {
  lockedMonths: [],
  accountHasTransactions: () => false,
  isCategoryUsed: () => false,
};
const accountId = id<'Account'>('aaaaaaaa-0000-4000-8000-000000000001');

/**
 * @returns A document on a newly created file in a mock host, with the host and session.
 */
async function setup() {
  const host = createMockHost();
  const session = createFileSession({
    store: createHostFileStore(host),
    digest: webDigest,
    clock: fixedClock(localDate('2026-11-28')),
    appVersion: '0.0.0-test',
    chooseSaveLocation: () => Promise.resolve(where),
    report: () => undefined,
  });
  const created = await session.create('Household 2027');
  if (!created.ok) {
    throw new Error('Expected the file to be created');
  }
  return { host, session, document: createBudgetDocument(session, created.value, () => context) };
}

describe('BudgetDocument', () => {
  describe('aNewlyOpenedFile', () => {
    it('isCleanWithItsModel', async () => {
      const { document } = await setup();
      expect(document.store.getState().dirty).toBe(false);
      expect(document.store.getState().model.accounts).toEqual([]);
    });
  });

  describe('aCommandThatSucceeds', () => {
    it('changesTheModelMarksItDirtyAndTellsSubscribers', async () => {
      const { document } = await setup();
      let notified = 0;
      document.store.subscribe(() => (notified += 1));
      const result = document.dispatch({
        kind: COMMAND_KIND.addAccount,
        id: accountId,
        name: 'Everyday',
        type: 'chequing',
      });
      expect(result.ok).toBe(true);
      expect(document.store.getState().model.accounts).toHaveLength(1);
      expect(document.store.getState().dirty).toBe(true);
      expect(notified).toBe(1);
    });
  });

  describe('aRefusedCommand', () => {
    it('changesNothingAndStaysClean', async () => {
      const { document } = await setup();
      const before = document.store.getState();
      const result = document.dispatch({ kind: COMMAND_KIND.deleteAccount, id: accountId });
      expect(result).toEqual({ ok: false, error: { code: FAILURE.unknownAccount } });
      expect(document.store.getState()).toBe(before);
    });
  });

  describe('save', () => {
    it('writesTheModelAndMakesTheDocumentCleanAgain', async () => {
      const { document, host } = await setup();
      document.dispatch({
        kind: COMMAND_KIND.addAccount,
        id: accountId,
        name: 'Everyday',
        type: 'chequing',
      });
      document.dispatch({
        kind: COMMAND_KIND.setStartingBalance,
        id: accountId,
        entered: money(100_00),
      });
      expect((await document.save()).ok).toBe(true);
      expect(document.store.getState().dirty).toBe(false);
      expect(host.controls.fileBytes(where.path)).toBeDefined();
    });

    it('keepsTheDocumentDirtyWhenTheFileChangedOnDisk', async () => {
      const { document, host } = await setup();
      document.dispatch({
        kind: COMMAND_KIND.addAccount,
        id: accountId,
        name: 'Everyday',
        type: 'chequing',
      });
      host.controls.putFile(where.path, new Uint8Array([1]));
      expect(await document.save()).toEqual({ ok: false, error: { kind: 'changedOnDisk' } });
      expect(document.store.getState().dirty).toBe(true);
    });
  });

  describe('aCommandWhileASaveIsRunning', () => {
    it('leavesTheDocumentDirtyBecauseTheSavedModelIsOlder', async () => {
      const { document } = await setup();
      document.dispatch({
        kind: COMMAND_KIND.addAccount,
        id: accountId,
        name: 'Everyday',
        type: 'chequing',
      });
      const saving = document.save();
      document.dispatch({
        kind: COMMAND_KIND.updateAccount,
        id: accountId,
        changes: { name: 'Main' },
      });
      await saving;
      expect(document.store.getState().dirty).toBe(true);
    });
  });
});
