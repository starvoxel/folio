// ------------------------------
// menu-template.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { MenuItemConstructorOptions } from 'electron';

import type { MenuCommand } from '@folio/host-api';

/**
 * Build the macOS menu bar (H1.16), kept to the minimum for now. Folio commands go to the page
 * through `send`; the text editing items use the system's roles. Undo and Redo are Folio commands
 * because they change the budget; the page decides when a focused text field takes them instead.
 * @param send - Delivers a command to the page.
 * @returns The menu template.
 */
export function buildMacMenuTemplate(
  send: (command: MenuCommand) => void,
): MenuItemConstructorOptions[] {
  const command = (
    label: string,
    name: MenuCommand,
    accelerator?: string,
  ): MenuItemConstructorOptions => ({
    label,
    ...(accelerator === undefined ? {} : { accelerator }),
    click: () => {
      send(name);
    },
  });
  return [
    {
      label: 'Folio',
      submenu: [
        command('About Folio', 'about'),
        { type: 'separator' },
        command('Settings…', 'settings', 'Cmd+,'),
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    // Only Save, for Cmd+S (H1.16). The other file commands join when files can be opened.
    { label: 'File', submenu: [command('Save', 'save', 'Cmd+S')] },
    {
      label: 'Edit',
      submenu: [
        command('Undo', 'undo', 'Cmd+Z'),
        command('Redo', 'redo', 'Shift+Cmd+Z'),
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];
}
