// ------------------------------
// csp.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { buildContentSecurityPolicy } from './csp.js';

describe('buildContentSecurityPolicy', () => {
  describe('aNonce', () => {
    it('putsItOnlyInTheStyleDirective', () => {
      const policy = buildContentSecurityPolicy('abc123');
      expect(policy.match(/nonce-abc123/gu)).toHaveLength(1);
      expect(policy).toContain("style-src 'self' 'nonce-abc123'");
    });
  });

  describe('theStrictDirectivesOfAD18', () => {
    it('denyEverythingByDefaultAndAllConnections', () => {
      const policy = buildContentSecurityPolicy('n');
      expect(policy).toContain("default-src 'none'");
      expect(policy).toContain("script-src 'self'");
      expect(policy).toContain("connect-src 'none'");
    });
  });

  describe('anyNonce', () => {
    it('neverAllowsUnsafeInlineOrEval', () => {
      const policy = buildContentSecurityPolicy('n');
      expect(policy).not.toContain('unsafe-inline');
      expect(policy).not.toContain('unsafe-eval');
      expect(policy).not.toContain('*');
    });
  });
});
