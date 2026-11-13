// ------------------------------
// licences.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  findLicenceProblems,
  isAllowedExpression,
  type LicenceException,
  type LockedPackage,
} from './support/licences.js';
import { repositoryRoot } from './support/repository.js';

/**
 * Read a JSON file of the repository.
 * @param name - The file name at the repository root.
 * @returns The parsed content; the caller says what shape it expects.
 */
function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(repositoryRoot, name), 'utf8')) as unknown;
}

describe('dependencyLicences', () => {
  describe('theInstalledTree', () => {
    it('isMitOrEquivalentOrHasARecordedDecision', () => {
      const lock = readJson('package-lock.json') as { packages: Record<string, LockedPackage> };
      const { exceptions } = readJson('licence-exceptions.json') as {
        exceptions: LicenceException[];
      };
      expect(findLicenceProblems(lock.packages, exceptions)).toEqual([]);
    });
  });

  describe('everyRecordedException', () => {
    it('namesAReasonAndADecision', () => {
      const { exceptions } = readJson('licence-exceptions.json') as {
        exceptions: LicenceException[];
      };
      for (const exception of exceptions) {
        expect(exception.reason.length).toBeGreaterThan(20);
        expect(exception.decision.length).toBeGreaterThan(20);
      }
    });
  });
});

describe('isAllowedExpression', () => {
  describe('aPermissiveLicence', () => {
    it('returnsTrue', () => {
      expect(isAllowedExpression('MIT')).toBe(true);
      expect(isAllowedExpression('Apache-2.0')).toBe(true);
    });
  });

  describe('aCopyleftLicence', () => {
    it('returnsFalse', () => {
      expect(isAllowedExpression('GPL-3.0-only')).toBe(false);
      expect(isAllowedExpression('MPL-2.0')).toBe(false);
    });
  });

  describe('anOrExpression', () => {
    it('needsOneAllowedSide', () => {
      expect(isAllowedExpression('(MIT OR GPL-3.0-only)')).toBe(true);
      expect(isAllowedExpression('GPL-2.0-only OR GPL-3.0-only')).toBe(false);
    });
  });

  describe('anAndExpression', () => {
    it('needsBothSides', () => {
      expect(isAllowedExpression('MIT AND ISC')).toBe(true);
      expect(isAllowedExpression('MIT AND GPL-3.0-only')).toBe(false);
    });
  });

  describe('emptyText', () => {
    it('returnsFalse', () => {
      expect(isAllowedExpression('')).toBe(false);
    });
  });
});

describe('findLicenceProblems', () => {
  const exception: LicenceException = {
    packages: ['tool'],
    license: 'MPL-2.0',
    reason: 'A build-time tool that is not shipped.',
    decision: 'Recorded for the test with a real sentence.',
  };

  describe('allAllowed', () => {
    it('returnsNoProblems', () => {
      const packages = { '': {}, 'node_modules/a': { license: 'MIT' } };
      expect(findLicenceProblems(packages, [])).toEqual([]);
    });
  });

  describe('aDisallowedPackageWithoutADecision', () => {
    it('namesThePackage', () => {
      const packages = { 'node_modules/x/node_modules/b': { license: 'GPL-3.0-only' } };
      expect(findLicenceProblems(packages, [])).toEqual([
        'b: GPL-3.0-only is not allowed and has no recorded decision',
      ]);
    });
  });

  describe('aPackageWithoutALicence', () => {
    it('isReported', () => {
      expect(findLicenceProblems({ 'node_modules/c': {} }, [])).toEqual([
        'c: no licence declared is not allowed and has no recorded decision',
      ]);
    });
  });

  describe('aDisallowedPackageWithADecision', () => {
    it('isAccepted', () => {
      const packages = { 'node_modules/tool': { license: 'MPL-2.0' } };
      expect(findLicenceProblems(packages, [exception])).toEqual([]);
    });
  });

  describe('aDecisionForAnotherLicenceVersion', () => {
    it('doesNotCoverThePackage', () => {
      const packages = { 'node_modules/tool': { license: 'GPL-3.0-only' } };
      expect(findLicenceProblems(packages, [exception])).toHaveLength(2);
    });
  });

  describe('aDecisionThatMatchesNothing', () => {
    it('isReportedAsStale', () => {
      expect(findLicenceProblems({ 'node_modules/a': { license: 'MIT' } }, [exception])).toEqual([
        'tool: the exception for MPL-2.0 matches nothing in the lockfile',
      ]);
    });
  });

  describe('workspaceLinksAndSources', () => {
    it('areSkipped', () => {
      const packages = {
        'packages/core': { license: 'UNLICENSED' },
        'node_modules/@folio/core': { license: 'UNLICENSED', link: true },
      };
      expect(findLicenceProblems(packages, [])).toEqual([]);
    });
  });
});
