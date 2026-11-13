// ------------------------------
// source-files.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listSourceFiles, repositoryRoot } from './support/repository.js';
import { findShapeProblems } from './support/test-shape.js';

const sourceFiles = listSourceFiles(['packages', 'apps', 'tests']);
const unitTestPattern = /^(packages|apps)\/[^/]+\/src\/.+\.test\.tsx?$/u;
const kebabFilePattern = /^[a-z0-9]+(-[a-z0-9]+)*(\.(test|e2e|d|config))?\.tsx?$/u;

const goodShape = `
describe('parseAmount', () => {
  describe('emptyInput', () => {
    it('returnsNothing', () => {});
  });
});
`;

describe('sourceFiles', () => {
  describe('workspace', () => {
    it('findsTheTypeScriptSources', () => {
      expect(sourceFiles.length).toBeGreaterThan(0);
    });
  });

  describe('fileNames', () => {
    it('areKebabCase', () => {
      const wrong = sourceFiles.filter((file) => {
        const name = file.split('/').at(-1) ?? file;
        return !kebabFilePattern.test(name);
      });
      expect(wrong).toEqual([]);
    });
  });

  describe('unitTests', () => {
    const unitTests = sourceFiles.filter((file) => /\.test\.tsx?$/u.test(file));

    it('sitInsideAPackageOrAppSource', () => {
      const misplaced = unitTests.filter(
        (file) =>
          !unitTestPattern.test(file) &&
          !file.startsWith('tests/integration/') &&
          !file.startsWith('tests/architecture/'),
      );
      expect(misplaced).toEqual([]);
    });

    it('sitNextToTheModuleTheyTest', () => {
      const orphaned = unitTests
        .filter((file) => unitTestPattern.test(file))
        .filter((file) => {
          const module = file.replace(/\.test\.tsx?$/u, '');
          return !(
            existsSync(join(repositoryRoot, `${module}.ts`)) ||
            existsSync(join(repositoryRoot, `${module}.tsx`))
          );
        });
      expect(orphaned).toEqual([]);
    });
  });

  describe('otherKinds', () => {
    it('keepEndToEndFilesUnderTestsE2e', () => {
      const misplaced = sourceFiles.filter(
        (file) => file.endsWith('.e2e.ts') && !file.startsWith('tests/e2e/'),
      );
      expect(misplaced).toEqual([]);
    });

    it('keepOnlyEndToEndSpecsDirectlyUnderTestsE2e', () => {
      const wrong = sourceFiles.filter(
        (file) =>
          file.startsWith('tests/e2e/') &&
          !file.slice('tests/e2e/'.length).includes('/') &&
          /\.test\.tsx?$/u.test(file),
      );
      expect(wrong).toEqual([]);
    });
  });

  describe('testNaming', () => {
    const testFiles = sourceFiles.filter((file) => /\.(test\.tsx?|e2e\.ts)$/u.test(file));

    it('followsTheThreeLevelShape', () => {
      const problems = testFiles.flatMap((file) =>
        findShapeProblems(readFileSync(join(repositoryRoot, file), 'utf8'), file).map(
          (problem) => `${file}: ${problem}`,
        ),
      );
      expect(problems).toEqual([]);
    });
  });
});

describe('findShapeProblems', () => {
  describe('describeDescribeIt', () => {
    it('acceptsTheShape', () => {
      expect(findShapeProblems(goodShape, 'a.test.ts')).toEqual([]);
    });
  });

  describe('itDirectlyUnderTheSubject', () => {
    it('reportsTheMissingCondition', () => {
      const source = "describe('subject', () => { it('returnsNothing', () => {}); });";
      expect(findShapeProblems(source, 'a.test.ts')).toHaveLength(1);
    });
  });

  describe('aFourthLevel', () => {
    it('reportsTheExtraDescribe', () => {
      const source = `describe('a', () => { describe('b', () => { describe('c', () => { it('d', () => {}); }); }); });`;
      expect(findShapeProblems(source, 'a.test.ts')).not.toEqual([]);
    });
  });

  describe('aSentenceAsName', () => {
    it('reportsTheName', () => {
      const source = `describe('a', () => { describe('b', () => { it('returns the thing', () => {}); }); });`;
      expect(findShapeProblems(source, 'a.test.ts')).toHaveLength(1);
    });
  });

  describe('aTopLevelIt', () => {
    it('reportsTheStart', () => {
      expect(findShapeProblems("it('a', () => {});", 'a.test.ts')).not.toEqual([]);
    });
  });

  describe('hooksInsideASuite', () => {
    it('areAllowed', () => {
      const source = `describe('a', () => { describe('b', () => { beforeEach(() => {}); it('c', () => {}); }); });`;
      expect(findShapeProblems(source, 'a.test.ts')).toEqual([]);
    });
  });
});
