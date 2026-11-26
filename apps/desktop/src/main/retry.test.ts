// ------------------------------
// retry.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { retryOnCodes } from './retry.js';

const failing = (code: string, times: number) => {
  let calls = 0;
  const work = (): Promise<string> => {
    calls += 1;
    return calls <= times
      ? Promise.reject(Object.assign(new Error('busy'), { code }))
      : Promise.resolve('done');
  };
  return { work, calls: () => calls };
};

describe('retryOnCodes', () => {
  describe('aTransientFailureThatClears', () => {
    it('retriesWithTheGivenWaitsAndReturnsTheResult', async () => {
      const waits: number[] = [];
      const { work, calls } = failing('EBUSY', 2);
      const result = await retryOnCodes(work, ['EBUSY'], [1, 2, 3], (ms) => {
        waits.push(ms);
        return Promise.resolve();
      });
      expect(result).toBe('done');
      expect(calls()).toBe(3);
      expect(waits).toEqual([1, 2]);
    });
  });

  describe('aFailureThatNeverClears', () => {
    it('throwsTheLastErrorAfterTheWaitsRunOut', async () => {
      const { work, calls } = failing('EPERM', 99);
      await expect(
        retryOnCodes(work, ['EPERM'], [1, 1], () => Promise.resolve()),
      ).rejects.toMatchObject({ code: 'EPERM' });
      expect(calls()).toBe(3);
    });
  });

  describe('anotherKindOfFailure', () => {
    it('isThrownAtOnce', async () => {
      const { work, calls } = failing('ENOSPC', 1);
      await expect(
        retryOnCodes(work, ['EPERM'], [1, 1], () => Promise.resolve()),
      ).rejects.toMatchObject({ code: 'ENOSPC' });
      expect(calls()).toBe(1);
    });
  });
});
