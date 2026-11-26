// ------------------------------
// serial-queue.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createSerialQueue } from './serial-queue.js';

describe('createSerialQueue', () => {
  describe('jobsWithTheSameKey', () => {
    it('runOneAfterAnotherInOrder', async () => {
      const queue = createSerialQueue();
      const events: string[] = [];
      const job = (name: string, ms: number) => async () => {
        events.push(`start ${name}`);
        await new Promise((resolve) => setTimeout(resolve, ms));
        events.push(`end ${name}`);
        return name;
      };
      const results = await Promise.all([
        queue.run('dir', job('a', 20)),
        queue.run('dir', job('b', 1)),
      ]);
      expect(results).toEqual(['a', 'b']);
      expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
    });
  });

  describe('aFailedJob', () => {
    it('rejectsItsOwnCallerAndDoesNotBlockTheNext', async () => {
      const queue = createSerialQueue();
      const failing = queue.run('dir', () => Promise.reject(new Error('disk full')));
      const next = queue.run('dir', () => Promise.resolve('ok'));
      await expect(failing).rejects.toThrow('disk full');
      expect(await next).toBe('ok');
    });
  });

  describe('jobsWithDifferentKeys', () => {
    it('doNotWaitForEachOther', async () => {
      const queue = createSerialQueue();
      const events: string[] = [];
      const slow = queue.run('one', async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        events.push('slow');
      });
      await queue.run('two', () => {
        events.push('fast');
        return Promise.resolve();
      });
      await slow;
      expect(events).toEqual(['fast', 'slow']);
    });
  });
});
