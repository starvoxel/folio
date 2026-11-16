// ------------------------------
// accessibility.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Page } from '@playwright/test';

const CONTROL_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'combobox',
  'radio',
  'checkbox',
  'switch',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'tab',
  'option',
  'slider',
  'spinbutton',
]);

/**
 * Read the browser's accessibility tree and list every interactive control that has no accessible
 * name. A control a screen reader announces only as "button" is a defect (AD-15).
 * @param page - The page to inspect.
 * @returns One description per unnamed control, empty when every control has a name.
 */
export async function findUnnamedControls(page: Page): Promise<string[]> {
  const client = await page.context().newCDPSession(page);
  try {
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    return nodes
      .filter((node) => !node.ignored)
      .filter((node) => CONTROL_ROLES.has(String(node.role?.value ?? '')))
      .filter((node) => String(node.name?.value ?? '').trim() === '')
      .map((node) => `${String(node.role?.value)} (node ${node.nodeId})`);
  } finally {
    await client.detach();
  }
}
