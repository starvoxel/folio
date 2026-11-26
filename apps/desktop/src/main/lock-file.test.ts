// ------------------------------
// lock-file.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  judgeLock,
  lockPathFor,
  OTHER_COMPUTER_STALE_MS,
  parseLock,
  serializeLock,
  type LockInfo,
} from './lock-file.js';

const self: LockInfo = { instance: 'me', host: 'KITCHEN-PC', pid: 10, takenMs: 0 };
const alive = (pid: number): boolean => pid === 10;
const input = (existing: string | null, nowMs = 1000) => ({
  existing,
  self,
  nowMs,
  isProcessAlive: alive,
});

describe('lockPathFor', () => {
  describe('aBudgetFile', () => {
    it('addsTheLockSuffix', () => {
      expect(lockPathFor('/a/b.folio')).toBe('/a/b.folio.lock');
    });
  });
});

describe('parseLock', () => {
  describe('aSerializedLock', () => {
    it('readsBackTheSameHolder', () => {
      expect(parseLock(serializeLock(self))).toEqual(self);
    });
  });

  describe('damagedText', () => {
    it('returnsNull', () => {
      for (const text of [
        '',
        '{',
        '[]',
        '{"instance":1}',
        '{"instance":"a","host":"h","pid":1.5,"takenMs":0}',
      ]) {
        expect(parseLock(text)).toBeNull();
      }
    });
  });
});

describe('judgeLock', () => {
  describe('noLockFile', () => {
    it('isFree', () => {
      expect(judgeLock(input(null))).toEqual({ kind: 'free' });
    });
  });

  describe('thisAppsOwnLock', () => {
    it('isOwn', () => {
      expect(judgeLock(input(serializeLock(self)))).toEqual({ kind: 'own' });
    });
  });

  describe('aLockFromARunningProcessOnThisComputer', () => {
    it('isHeldAndNotStale', () => {
      const other = serializeLock({ ...self, instance: 'x', pid: 10 });
      expect(judgeLock(input(other))).toEqual({ kind: 'held', holder: 'KITCHEN-PC', stale: false });
    });
  });

  describe('aLockFromAProcessThatDied', () => {
    it('isHeldAndStale', () => {
      const other = serializeLock({ ...self, instance: 'x', pid: 99 });
      expect(judgeLock(input(other))).toEqual({ kind: 'held', holder: 'KITCHEN-PC', stale: true });
    });
  });

  describe('aLockFromAnotherComputer', () => {
    it('isStaleOnlyAfterTheLimit', () => {
      const other = serializeLock({ instance: 'x', host: 'STUDY-MAC', pid: 99, takenMs: 0 });
      expect(judgeLock(input(other, OTHER_COMPUTER_STALE_MS))).toEqual({
        kind: 'held',
        holder: 'STUDY-MAC',
        stale: false,
      });
      expect(judgeLock(input(other, OTHER_COMPUTER_STALE_MS + 1))).toEqual({
        kind: 'held',
        holder: 'STUDY-MAC',
        stale: true,
      });
    });
  });

  describe('aDamagedLockFile', () => {
    it('isHeldByAnUnknownHolderAndStale', () => {
      expect(judgeLock(input('{"half'))).toEqual({ kind: 'held', holder: 'unknown', stale: true });
    });
  });
});
