// ------------------------------
// file-drops.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { watchFileDrops, type DropEventLike, type DropTarget } from './file-drops.js';

/**
 * @returns A fake window that records listeners, and a way to fire an event at them.
 */
function setup() {
  const listeners = new Map<string, (event: DropEventLike) => void>();
  const target: DropTarget = {
    addEventListener: (type, listener) => void listeners.set(type, listener),
  };
  const reported: string[][] = [];
  watchFileDrops(
    target,
    (file) => (file as { path: string }).path,
    (paths) => void reported.push(paths),
  );
  const fire = (
    type: 'dragover' | 'drop',
    event: Partial<DropEventLike> & { prevented?: { v: boolean } },
  ) => {
    const prevented = { v: false };
    listeners.get(type)?.({
      isTrusted: true,
      dataTransfer: { types: ['Files'], files: [] },
      preventDefault: () => {
        prevented.v = true;
      },
      ...event,
    });
    return prevented.v;
  };
  return { fire, reported };
}

const files = (...paths: string[]) => ({
  types: ['Files'],
  files: paths.map((path) => ({ path })),
});

describe('watchFileDrops', () => {
  describe('aUserDropOfFiles', () => {
    it('reportsTheirPathsAndStopsTheBrowserNavigating', () => {
      const { fire, reported } = setup();
      expect(fire('dragover', {})).toBe(true);
      expect(fire('drop', { dataTransfer: files('/a.csv', '/b.csv') })).toBe(true);
      expect(reported).toEqual([['/a.csv', '/b.csv']]);
    });
  });

  describe('aDropAScriptMadeUp', () => {
    it('isNotReported', () => {
      const { fire, reported } = setup();
      fire('drop', { isTrusted: false, dataTransfer: files('/a.csv') });
      expect(reported).toEqual([]);
    });
  });

  describe('anInPageDrag', () => {
    it('isLeftAloneForThePage', () => {
      const { fire, reported } = setup();
      const inPage = { types: ['text/plain'], files: [] };
      expect(fire('dragover', { dataTransfer: inPage })).toBe(false);
      expect(fire('drop', { dataTransfer: inPage })).toBe(false);
      expect(reported).toEqual([]);
    });
  });

  describe('filesWithoutAPath', () => {
    it('areDropped', () => {
      const { fire, reported } = setup();
      fire('drop', { dataTransfer: files('', '/a.csv') });
      expect(reported).toEqual([['/a.csv']]);
      fire('drop', { dataTransfer: files('') });
      expect(reported).toHaveLength(1);
    });
  });
});
