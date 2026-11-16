// ------------------------------
// pages.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { AppIconName } from '../ui/fluent/index.js';

/** Every page of the app, in navigation order with Settings last. */
export const PAGE_IDS = [
  'overview',
  'transactions',
  'reporting',
  'net-worth',
  'accounts',
  'rules',
  'settings',
] as const;

/** The identifier of a page. */
export type PageId = (typeof PAGE_IDS)[number];

/** What the shell needs to know about a page. */
export interface PageDefinition {
  readonly id: PageId;
  /** The page's title: its navigation label and its level-one heading. */
  readonly title: string;
  readonly icon: AppIconName;
}

/** Every page, keyed by id. */
export const PAGES: Readonly<Record<PageId, PageDefinition>> = {
  overview: { id: 'overview', title: 'Overview', icon: 'overview' },
  transactions: { id: 'transactions', title: 'Transactions', icon: 'transactions' },
  reporting: { id: 'reporting', title: 'Reporting', icon: 'reporting' },
  'net-worth': { id: 'net-worth', title: 'Net worth', icon: 'netWorth' },
  accounts: { id: 'accounts', title: 'Accounts', icon: 'accounts' },
  rules: { id: 'rules', title: 'Rules & categories', icon: 'rules' },
  settings: { id: 'settings', title: 'Settings', icon: 'settings' },
};

/** The pages listed in the main part of the navigation pane (H1.4). */
export const NAVIGATION_PAGES: readonly PageDefinition[] = PAGE_IDS.filter(
  (id) => id !== 'settings',
).map((id) => PAGES[id]);

/** The pages pinned to the bottom of the navigation pane. */
export const FOOTER_PAGES: readonly PageDefinition[] = [PAGES.settings];

/**
 * Check whether a value names a page.
 * @param value - The value to test.
 * @returns True when it is a page id.
 */
export function isPageId(value: unknown): value is PageId {
  return typeof value === 'string' && (PAGE_IDS as readonly string[]).includes(value);
}
