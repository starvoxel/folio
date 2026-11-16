// ------------------------------
// dependabot-groups.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

import {
  findCoupledPairs,
  findGroupProblems,
  groupOf,
  isSingleMajor,
  matchesPattern,
  type DependabotGroup,
  type LockedDependencies,
} from './support/dependabot-groups.js';
import { repositoryRoot } from './support/repository.js';

interface RawGroup {
  readonly 'applies-to'?: string;
  readonly patterns?: string[];
  readonly 'exclude-patterns'?: string[];
}

interface RawUpdate {
  readonly 'package-ecosystem': string;
  readonly groups?: Record<string, RawGroup>;
}

/**
 * Read a JSON file of the repository.
 * @param path - The path from the repository root.
 * @returns The parsed content; the caller says what shape it expects.
 */
function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(repositoryRoot, path), 'utf8')) as unknown;
}

/**
 * Read the npm version-update groups of .github/dependabot.yml, in file order.
 * @returns The groups.
 */
function readNpmGroups(): DependabotGroup[] {
  const file = parse(readFileSync(join(repositoryRoot, '.github', 'dependabot.yml'), 'utf8')) as {
    updates: RawUpdate[];
  };
  const npm = file.updates.find((update) => update['package-ecosystem'] === 'npm');
  return Object.entries(npm?.groups ?? {})
    .filter(([, group]) => (group['applies-to'] ?? 'version-updates') === 'version-updates')
    .map(([name, group]) => ({
      name,
      ...(group.patterns === undefined ? {} : { patterns: group.patterns }),
      ...(group['exclude-patterns'] === undefined
        ? {}
        : { excludePatterns: group['exclude-patterns'] }),
    }));
}

/**
 * Collect the direct dependencies of the root and of every workspace.
 * @returns Their names, without the repository's own packages.
 */
function readDirectDependencies(): Set<string> {
  const manifests = ['package.json'];
  for (const folder of ['packages', 'apps']) {
    for (const entry of readdirSync(join(repositoryRoot, folder), { withFileTypes: true })) {
      if (entry.isDirectory()) {
        manifests.push(`${folder}/${entry.name}/package.json`);
      }
    }
  }
  const names = new Set<string>();
  for (const manifest of manifests) {
    const content = readJson(manifest) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    for (const name of [
      ...Object.keys(content.dependencies ?? {}),
      ...Object.keys(content.devDependencies ?? {}),
    ]) {
      if (!name.startsWith('@folio/')) {
        names.add(name);
      }
    }
  }
  return names;
}

/**
 * Index the lockfile: the peer ranges of each top-level package, and the name of every package.
 * @returns The entries by name, and the set of installed names.
 */
function readLockIndex(): {
  locked: Record<string, LockedDependencies | undefined>;
  installed: Set<string>;
} {
  const lock = readJson('package-lock.json') as { packages: Record<string, LockedDependencies> };
  const locked: Record<string, LockedDependencies | undefined> = {};
  const installed = new Set<string>();
  const marker = 'node_modules/';
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path.includes(marker)) {
      const name = path.slice(path.lastIndexOf(marker) + marker.length);
      installed.add(name);
      if (path === `${marker}${name}`) {
        locked[name] = entry;
      }
    }
  }
  return { locked, installed };
}

describe('dependabotGroups', () => {
  describe('theRealRepository', () => {
    it('keepsEveryCoupledPairOfDirectDependenciesInOneNamedGroup', () => {
      const { locked, installed } = readLockIndex();
      expect(
        findGroupProblems(readNpmGroups(), readDirectDependencies(), locked, installed),
      ).toEqual([]);
    });

    it('findsTheCouplesThatMotivateTheGroups', () => {
      const { locked } = readLockIndex();
      const pairs = findCoupledPairs(readDirectDependencies(), locked).map(
        (pair) => `${pair.first}+${pair.second}`,
      );
      expect(pairs).toEqual(
        expect.arrayContaining([
          'react-dom+react',
          '@types/react-dom+@types/react',
          '@vitejs/plugin-react+vite',
          '@eslint/js+eslint',
          '@types/ws+ws',
          'typescript+typescript-eslint',
          '@electron/packager+@electron/asar',
        ]),
      );
    });
  });
});

describe('matchesPattern', () => {
  describe('aWildcardAtTheEnd', () => {
    it('matchesTheWholeScope', () => {
      expect(matchesPattern('@electron/*', '@electron/asar')).toBe(true);
      expect(matchesPattern('@electron/*', 'electron')).toBe(false);
    });
  });

  describe('anExactName', () => {
    it('matchesOnlyThatName', () => {
      expect(matchesPattern('react', 'react')).toBe(true);
      expect(matchesPattern('react', 'react-dom')).toBe(false);
    });
  });

  describe('aNameWithRegexCharacters', () => {
    it('isTakenLiterally', () => {
      expect(matchesPattern('a.b', 'axb')).toBe(false);
    });
  });
});

describe('groupOf', () => {
  const groups: DependabotGroup[] = [
    { name: 'first', patterns: ['a', 'b'] },
    { name: 'second', patterns: ['*'], excludePatterns: ['z'] },
    { name: 'patches' },
  ];

  describe('aPackageThatMatchesTwoGroups', () => {
    it('belongsToTheFirst', () => {
      expect(groupOf(groups, 'a')).toBe('first');
    });
  });

  describe('anExcludedPackage', () => {
    it('fallsThroughToNoNamedGroup', () => {
      expect(groupOf(groups, 'z')).toBeNull();
    });
  });
});

describe('isSingleMajor', () => {
  describe('aCaretRange', () => {
    it('returnsTrue', () => {
      expect(isSingleMajor('^19.3.1')).toBe(true);
      expect(isSingleMajor('^8.0.0')).toBe(true);
    });
  });

  describe('aWideRange', () => {
    it('returnsFalse', () => {
      for (const range of ['>=16.14.0 <20.0.0', '^8.57.0 || ^9.0.0 || ^10.0.0', '*', '>=7.0.0']) {
        expect(isSingleMajor(range)).toBe(false);
      }
    });
  });

  describe('textThatIsNotARange', () => {
    it('returnsFalse', () => {
      expect(isSingleMajor('not a range')).toBe(false);
    });
  });
});

describe('findGroupProblems', () => {
  const direct = new Set(['react', 'react-dom', '@types/ws', 'ws', 'lonely']);
  const lockedEntries: Record<string, LockedDependencies> = {
    'react-dom': { peerDependencies: { react: '^19.3.1' } },
  };
  const installed = new Set([...direct]);

  describe('aTightPairInTheSameGroup', () => {
    it('returnsNoProblems', () => {
      const groups: DependabotGroup[] = [
        { name: 'react', patterns: ['react', 'react-dom'] },
        { name: 'ws', patterns: ['ws', '@types/ws'] },
      ];
      expect(findGroupProblems(groups, direct, lockedEntries, installed)).toEqual([]);
    });
  });

  describe('aTightPairSplitAcrossGroups', () => {
    it('namesBothPackagesAndTheReason', () => {
      const groups: DependabotGroup[] = [
        { name: 'react', patterns: ['react'] },
        { name: 'dom', patterns: ['react-dom'] },
        { name: 'ws', patterns: ['ws', '@types/ws'] },
      ];
      expect(findGroupProblems(groups, direct, lockedEntries, installed)).toEqual([
        'react-dom (dom) and react (react) must share a named group: react-dom peers on react ^19.3.1',
      ]);
    });
  });

  describe('aTypesPackageOutsideTheGroupOfItsPackage', () => {
    it('isReportedBecauseNeitherHasANamedGroup', () => {
      const groups: DependabotGroup[] = [{ name: 'react', patterns: ['react', 'react-dom'] }];
      expect(findGroupProblems(groups, direct, lockedEntries, installed)).toEqual([
        '@types/ws (no named group) and ws (no named group) must share a named group: @types/ws describes ws',
      ]);
    });
  });

  describe('aPatternThatMatchesNothing', () => {
    it('isReportedAsStale', () => {
      const groups: DependabotGroup[] = [
        { name: 'react', patterns: ['react', 'react-dom', 'preact'] },
        { name: 'ws', patterns: ['ws', '@types/ws'] },
      ];
      expect(findGroupProblems(groups, direct, lockedEntries, installed)).toEqual([
        'group react: pattern preact matches no installed package',
      ]);
    });
  });
});
