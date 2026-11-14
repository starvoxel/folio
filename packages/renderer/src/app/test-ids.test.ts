// ------------------------------
// test-ids.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { PAGE_IDS } from './pages.js';
import { testIds } from './test-ids.js';

const kebab = /^[a-z]+(-[a-z]+)*$/u;

/**
 * Gather every test id the app defines, with the dynamic ones filled in.
 * @returns The ids.
 */
function allTestIds(): string[] {
  return [
    ...PAGE_IDS.map((page) => testIds.nav(page)),
    ...PAGE_IDS.map((page) => testIds.page(page)),
    ...Object.values(testIds.topBar).filter((value) => typeof value === 'string'),
    testIds.topBar.menuItem('save'),
    testIds.settings.theme,
    testIds.settings.reset,
    ...(['light', 'dark', 'system'] as const).map((theme) => testIds.settings.themeOption(theme)),
    testIds.dialog.resetSettings,
  ];
}

describe('testIds', () => {
  describe('everyId', () => {
    it('isLowerCaseKebabCase', () => {
      expect(allTestIds().filter((id) => !kebab.test(id))).toEqual([]);
    });

    it('isUnique', () => {
      const ids = allTestIds();
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('areaPrefixes', () => {
    it('putTheAreaFirst', () => {
      expect(testIds.nav('overview')).toBe('nav-overview');
      expect(testIds.page('net-worth')).toBe('page-net-worth');
      expect(testIds.settings.themeOption('dark')).toBe('settings-theme-dark');
    });
  });
});
