// ------------------------------
// layout-rules.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findLayoutLogicProblems, findScreenLayoutProblems } from './support/layout-code.js';
import { listSourceFiles, repositoryRoot } from './support/repository.js';

const productionFiles = (folder: string): string[] =>
  listSourceFiles([folder]).filter((file) => !/\.test\.tsx?$/u.test(file));

/**
 * Report the files whose source has problems.
 * @param files - Repository-relative paths.
 * @param find - The check to run on each file's text.
 * @returns `file: problem` lines.
 */
function problemsIn(files: readonly string[], find: (source: string) => string[]): string[] {
  return files.flatMap((file) =>
    find(readFileSync(join(repositoryRoot, file), 'utf8')).map((problem) => `${file}: ${problem}`),
  );
}

describe('screens', () => {
  describe('theRealScreens', () => {
    const screens = productionFiles('packages/renderer/src/screens');

    it('areFound', () => {
      expect(screens.length).toBeGreaterThan(0);
    });

    it('containNoLayoutCode', () => {
      expect(problemsIn(screens, findScreenLayoutProblems)).toEqual([]);
    });
  });
});

describe('layoutLogic', () => {
  describe('theRealLayoutModules', () => {
    const modules = productionFiles('packages/renderer/src/layout');

    it('areFound', () => {
      expect(modules.length).toBeGreaterThan(0);
    });

    it('touchNoBrowserGlobals', () => {
      expect(problemsIn(modules, findLayoutLogicProblems)).toEqual([]);
    });
  });
});

describe('findScreenLayoutProblems', () => {
  describe('aMediaQueryInAStyleString', () => {
    it('reportsIt', () => {
      expect(findScreenLayoutProblems("const css = '@media (min-width: 900px) {}';")).toEqual([
        'a media or container query',
      ]);
    });
  });

  describe('matchMediaOrAWidthRead', () => {
    it('reportsEach', () => {
      expect(findScreenLayoutProblems('window.matchMedia(query);')).toContain(
        'matchMedia or useMediaQuery',
      );
      expect(findScreenLayoutProblems('const w = window.innerWidth;')).toContain(
        'a read of a window or element size',
      );
      expect(findScreenLayoutProblems('el.getBoundingClientRect();')).toContain(
        'a read of a window or element size',
      );
    });
  });

  describe('theLayoutHookOrTheProfile', () => {
    it('reportsThem', () => {
      expect(findScreenLayoutProblems('const { resolved } = useLayout();')).toContain(
        'the layout hook',
      );
      expect(findScreenLayoutProblems('if (formFactor === "phone") {}')).toContain(
        'the form-factor profile',
      );
    });
  });

  describe('aClassNameOrAnInlineStyle', () => {
    it('reportsThem', () => {
      expect(findScreenLayoutProblems('<div className="wide" />')).toContain('a class name');
      expect(findScreenLayoutProblems('<div style={{ width: 300 }} />')).toContain(
        'an inline style',
      );
    });
  });

  describe('aResizeObserverOrAStyleSheet', () => {
    it('reportsThem', () => {
      expect(findScreenLayoutProblems('new ResizeObserver(cb);')).toContain('a resize observer');
      expect(findScreenLayoutProblems("import styles from './page.css';")).toContain(
        'a style sheet import',
      );
    });
  });

  describe('contentOnly', () => {
    it('reportsNothing', () => {
      const source = `
        // A page may say "className" or @media in a comment.
        /* and useLayout in a block comment */
        export function Page() { return <Card title="Hello"><SecondaryText>Hi</SecondaryText></Card>; }
      `;
      expect(findScreenLayoutProblems(source)).toEqual([]);
    });
  });
});

describe('findLayoutLogicProblems', () => {
  describe('aBrowserGlobalOrAnObserver', () => {
    it('reportsEach', () => {
      expect(findLayoutLogicProblems('const w = window.innerWidth;')).toContain('a browser global');
      expect(findLayoutLogicProblems('document.title = "a";')).toContain('a browser global');
      expect(findLayoutLogicProblems('matchMedia("(pointer: coarse)")')).toContain('matchMedia');
      expect(findLayoutLogicProblems('new ResizeObserver(cb)')).toContain('a resize observer');
    });
  });

  describe('pureArithmetic', () => {
    it('reportsNothing', () => {
      expect(findLayoutLogicProblems('export const a = (width: number) => width >= 900;')).toEqual(
        [],
      );
    });
  });
});
