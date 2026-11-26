// ------------------------------
// findings.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { distinctFindings, hasFailures, type Finding } from './findings.js';

const blocked: Finding = { source: 'dns', detail: 'dns query a.test', allowed: false };
const notice: Finding = { source: 'strace', detail: 'connect x', allowed: true, reason: 'known' };

describe('hasFailures', () => {
  describe('noFindings', () => {
    it('returnsFalse', () => {
      expect(hasFailures([])).toBe(false);
    });
  });

  describe('onlyAllowedNotices', () => {
    it('returnsFalse', () => {
      expect(hasFailures([notice])).toBe(false);
    });
  });

  describe('oneBlockedFinding', () => {
    it('returnsTrue', () => {
      expect(hasFailures([notice, blocked])).toBe(true);
    });
  });
});

describe('distinctFindings', () => {
  describe('repeats', () => {
    it('keepsTheFirstOfEach', () => {
      expect(distinctFindings([blocked, notice, blocked, blocked])).toEqual([blocked, notice]);
    });
  });
});
