// ------------------------------
// report.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import type { Finding } from './findings.js';
import { renderReport, SAMPLER_LIMITS } from './report.js';

const blocked: Finding = { source: 'dns', detail: 'dns query a.test', allowed: false };
const notice: Finding = { source: 'strace', detail: 'connect x', allowed: true, reason: 'known' };

describe('renderReport', () => {
  describe('aCleanRunWithTheControlSeen', () => {
    it('saysPassedAndListsNotices', () => {
      const text = renderReport({ title: 'Linux', controlSeen: true, findings: [notice] });
      expect(text).toContain('Linux: passed');
      expect(text).toContain('connect x (known)');
    });
  });

  describe('aBlockedAttempt', () => {
    it('saysFailedAndNamesIt', () => {
      const text = renderReport({
        title: 'Linux',
        controlSeen: true,
        findings: [blocked, blocked],
      });
      expect(text).toContain('Linux: FAILED');
      expect(text.match(/dns query a\.test/gu)).toHaveLength(1);
    });
  });

  describe('aMissedPositiveControl', () => {
    it('failsEvenWithNoFindings', () => {
      const text = renderReport({ title: 'Windows', controlSeen: false, findings: [] });
      expect(text).toContain('Windows: FAILED');
      expect(text).toContain('capture is blind');
    });
  });

  describe('statedLimits', () => {
    it('appearInTheReport', () => {
      const text = renderReport({
        title: 'macOS',
        controlSeen: true,
        findings: [],
        limits: SAMPLER_LIMITS,
      });
      expect(text).toContain('Cannot observe: Sockets are read once a second');
    });
  });
});
