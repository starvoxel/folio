// ------------------------------
// menu-automation.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { describeMenu, findMenuItem, type MenuItemLike } from './menu-automation.js';

const clicked: string[] = [];
const item = (label: string, extra: Partial<MenuItemLike> = {}): MenuItemLike => ({
  label,
  click: () => void clicked.push(label),
  ...extra,
});
const menu: MenuItemLike[] = [
  item('File', {
    submenu: {
      items: [item('Save', { accelerator: 'Cmd+S' }), item('', {}), item('Open…')],
    },
  }),
  item('Edit', { submenu: { items: [item('Undo', { accelerator: 'Cmd+Z' })] } }),
];

describe('findMenuItem', () => {
  describe('aPathToAnItem', () => {
    it('returnsThatItem', () => {
      findMenuItem(menu, ['File', 'Save'])?.click();
      expect(clicked).toEqual(['Save']);
    });
  });

  describe('aMissingPath', () => {
    it('returnsNull', () => {
      expect(findMenuItem(menu, ['File', 'Print'])).toBeNull();
      expect(findMenuItem(menu, ['View'])).toBeNull();
      expect(findMenuItem(menu, [])).toBeNull();
    });
  });
});

describe('describeMenu', () => {
  describe('aMenuWithSeparators', () => {
    it('listsLabelsShortcutsAndChildrenWithoutSeparators', () => {
      expect(describeMenu(menu)).toEqual([
        {
          label: 'File',
          children: [{ label: 'Save', accelerator: 'Cmd+S' }, { label: 'Open…' }],
        },
        { label: 'Edit', children: [{ label: 'Undo', accelerator: 'Cmd+Z' }] },
      ]);
    });
  });
});
