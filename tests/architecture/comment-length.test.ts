// ------------------------------
// comment-length.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-24
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { Linter } from 'eslint';
import { describe, expect, it } from 'vitest';

import folio from '../../tools/eslint/folio-plugin.js';

const linter = new Linter();
const config = [
  {
    plugins: { folio },
    rules: { 'folio/max-comment-lines': ['error', { line: 3, jsdoc: 4, tag: 2 }] },
  },
] as unknown as Linter.Config[];

/**
 * Lint a source snippet with the comment-length rule alone.
 * @param code - The source text.
 * @returns The messages the rule reported.
 */
function lint(code: string): string[] {
  return linter.verify(code, config, 'sample.js').map((message) => message.message);
}

const lines = (count: number): string =>
  Array.from({ length: count }, (_, i) => `// line ${String(i)}`).join('\n');

describe('maxCommentLines', () => {
  describe('lineComments', () => {
    it('allowsThreeLines', () => {
      expect(lint(`${lines(3)}\nconst a = 1;`)).toEqual([]);
    });

    it('flagsFourLines', () => {
      expect(lint(`const a = 1;\n${lines(4)}\nconst b = 2;`)).toHaveLength(1);
    });

    it('countsSeparatedBlocksApart', () => {
      expect(lint(`${lines(3)}\nconst a = 1;\n${lines(3)}\nconst b = 2;`)).toEqual([]);
    });

    it('ignoresFileHeader', () => {
      expect(lint(`${lines(7)}\n\nconst a = 1;`)).toEqual([]);
    });

    it('ignoresDirectives', () => {
      const directives = Array.from({ length: 5 }, () => '// prettier-ignore').join('\n');
      expect(lint(`const a = 1;\n${directives}\nconst b = 2;`)).toEqual([]);
    });
  });

  describe('jsdocComments', () => {
    it('allowsFourDescriptionLines', () => {
      expect(lint('/**\n * a\n * b\n * c\n * d\n */\nfunction f() {}')).toEqual([]);
    });

    it('flagsFiveDescriptionLines', () => {
      expect(lint('/**\n * a\n * b\n * c\n * d\n * e\n */\nfunction f() {}')).toHaveLength(1);
    });

    it('doesNotCountTagLinesAsDescription', () => {
      const tags = ' * @param a - x\n * @param b - y\n * @param c - z\n * @returns w';
      expect(lint(`/**\n * a\n * b\n * c\n * d\n${tags}\n */\nfunction f() {}`)).toEqual([]);
    });

    it('flagsATagOfThreeLines', () => {
      expect(lint('/**\n * @param a - x\n * y\n * z\n */\nfunction f() {}')).toHaveLength(1);
    });
  });
});
