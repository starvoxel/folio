// ------------------------------
// path-grants.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createPathGrants } from './path-grants.js';

describe('createPathGrants', () => {
  describe('aGrantedPath', () => {
    it('isGrantedAndOthersAreNot', () => {
      const grants = createPathGrants('linux');
      grants.grant('/home/a/b.folio');
      expect(grants.isGranted('/home/a/b.folio')).toBe(true);
      expect(grants.isGranted('/home/a/c.folio')).toBe(false);
    });
  });

  describe('aPathWrittenWithDotSegments', () => {
    it('matchesAfterResolving', () => {
      const grants = createPathGrants('linux');
      grants.grant('/home/a/b.folio');
      expect(grants.isGranted('/home/a/x/../b.folio')).toBe(true);
    });
  });

  describe('caseOnLinuxAndOnWindows', () => {
    it('isSignificantOnlyOnLinux', () => {
      const linux = createPathGrants('linux');
      linux.grant('/Home/A.folio');
      expect(linux.isGranted('/home/a.folio')).toBe(false);
      const mac = createPathGrants('darwin');
      mac.grant('/Home/A.folio');
      expect(mac.isGranted('/home/a.folio')).toBe(true);
    });
  });

  describe('relativeOrNulPaths', () => {
    it('areNeverGranted', () => {
      const grants = createPathGrants('linux');
      grants.grant('relative.folio');
      grants.grant('/a\0b');
      expect(grants.isGranted('relative.folio')).toBe(false);
      expect(grants.isGranted('/a\0b')).toBe(false);
    });
  });
});
