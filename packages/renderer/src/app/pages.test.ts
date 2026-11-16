// ------------------------------
// pages.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { FOOTER_PAGES, NAVIGATION_PAGES, PAGES, PAGE_IDS, isPageId } from './pages.js';

describe('pages', () => {
  describe('navigationPages', () => {
    it('listTheSixMainPagesInOrder', () => {
      expect(NAVIGATION_PAGES.map((page) => page.title)).toEqual([
        'Overview',
        'Transactions',
        'Reporting',
        'Net worth',
        'Accounts',
        'Rules & categories',
      ]);
    });
  });

  describe('footerPages', () => {
    it('holdOnlySettings', () => {
      expect(FOOTER_PAGES.map((page) => page.id)).toEqual(['settings']);
    });
  });

  describe('everyPageId', () => {
    it('hasADefinitionWithTheSameId', () => {
      for (const id of PAGE_IDS) {
        expect(PAGES[id].id).toBe(id);
      }
    });
  });
});

describe('isPageId', () => {
  describe('aPageId', () => {
    it('returnsTrue', () => {
      expect(isPageId('net-worth')).toBe(true);
    });
  });

  describe('somethingElse', () => {
    it('returnsFalse', () => {
      expect(isPageId('close')).toBe(false);
      expect(isPageId('')).toBe(false);
      expect(isPageId(undefined)).toBe(false);
    });
  });
});
