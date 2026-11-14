// ------------------------------
// app-files.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { resolveAppFile } from './app-files.js';

const root = resolve('app-root');

describe('resolveAppFile', () => {
  describe('theRootPath', () => {
    it('returnsIndexHtml', () => {
      expect(resolveAppFile(root, '/')).toBe(resolve(root, 'index.html'));
      expect(resolveAppFile(root, '')).toBe(resolve(root, 'index.html'));
    });
  });

  describe('aFileInsideTheRoot', () => {
    it('returnsItsPath', () => {
      expect(resolveAppFile(root, '/assets/index.js')).toBe(resolve(root, 'assets', 'index.js'));
    });
  });

  describe('aPathThatClimbsOutOfTheRoot', () => {
    it('returnsNull', () => {
      expect(resolveAppFile(root, '/../secret.txt')).toBeNull();
      expect(resolveAppFile(root, '/assets/../../secret.txt')).toBeNull();
      expect(resolveAppFile(root, '/%2e%2e/secret.txt')).toBeNull();
    });
  });

  describe('aBrokenPercentEscape', () => {
    it('returnsNull', () => {
      expect(resolveAppFile(root, '/%E0%A4%A')).toBeNull();
    });
  });

  describe('aSiblingFolderWithTheSamePrefix', () => {
    it('returnsNull', () => {
      expect(resolveAppFile(root, '/../app-root-evil/x.js')).toBeNull();
    });
  });
});
