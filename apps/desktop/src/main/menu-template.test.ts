// ------------------------------
// menu-template.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import type { MenuCommand } from '@folio/host-api';

import { buildMacMenuTemplate } from './menu-template.js';

type MenuItemConstructorOptions = ReturnType<typeof buildMacMenuTemplate>[number];

/**
 * @param items - A submenu's items.
 * @returns The items that have a click handler, by label.
 */
function clickable(items: unknown): Map<string, MenuItemConstructorOptions> {
  const found = new Map<string, MenuItemConstructorOptions>();
  for (const item of (items ?? []) as MenuItemConstructorOptions[]) {
    if (item.click !== undefined && item.label !== undefined) {
      found.set(item.label, item);
    }
  }
  return found;
}

describe('buildMacMenuTemplate', () => {
  const sent: MenuCommand[] = [];
  const template = buildMacMenuTemplate((command) => void sent.push(command));
  const menu = (label: string): Map<string, MenuItemConstructorOptions> =>
    clickable(template.find((entry) => entry.label === label)?.submenu);

  describe('theAppMenu', () => {
    it('hasAboutSettingsAndQuit', () => {
      const app = template.find((entry) => entry.label === 'Folio');
      const roles = (app?.submenu as MenuItemConstructorOptions[]).map((item) => item.role);
      expect(roles).toContain('quit');
      expect([...menu('Folio').keys()]).toEqual(['About Folio', 'Settings…']);
    });
  });

  describe('theFileAndEditMenus', () => {
    it('bindTheStandardShortcutsToFolioCommands', () => {
      expect(menu('File').get('Save')?.accelerator).toBe('Cmd+S');
      expect(menu('Edit').get('Undo')?.accelerator).toBe('Cmd+Z');
      expect(menu('Edit').get('Redo')?.accelerator).toBe('Shift+Cmd+Z');
    });
  });

  describe('theEditMenuTextItems', () => {
    it('useTheSystemRolesSoTextFieldsWork', () => {
      const edit = template.find((entry) => entry.label === 'Edit');
      const roles = (edit?.submenu as MenuItemConstructorOptions[]).map((item) => item.role);
      expect(roles).toEqual(expect.arrayContaining(['cut', 'copy', 'paste', 'selectAll']));
    });
  });

  describe('clickingEveryFolioCommand', () => {
    it('sendsItsCommandToThePage', () => {
      sent.length = 0;
      for (const label of ['File', 'Edit', 'Folio']) {
        for (const item of menu(label).values()) {
          (item.click as () => void)();
        }
      }
      expect(sent.sort()).toEqual(
        [
          'about',
          'settings',
          'new',
          'open',
          'save',
          'saveAs',
          'closeFile',
          'importCsv',
          'undo',
          'redo',
        ].sort(),
      );
    });
  });
});
