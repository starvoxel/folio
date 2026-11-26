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
 * Build the macOS menu bar (H1.16). Items that are Folio commands send a `MenuCommand` to the page
 * through `send`; the standard Edit items for text use the system's own roles. Undo and Redo are
 * Folio commands, not roles, because they change the budget; the page decides when a focused text
 * field should take them instead. Windows and Linux have no menu bar (H1.14 is the hamburger menu).
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
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        command('New', 'new', 'Cmd+N'),
        command('Open…', 'open', 'Cmd+O'),
        { type: 'separator' },
        command('Save', 'save', 'Cmd+S'),
        command('Save As…', 'saveAs', 'Shift+Cmd+S'),
        command('Close file', 'closeFile', 'Cmd+W'),
        { type: 'separator' },
        command('Import CSV…', 'importCsv', 'Cmd+I'),
      ],
    },
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
    { role: 'windowMenu' },
  ];
}
