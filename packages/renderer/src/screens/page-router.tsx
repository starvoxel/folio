// ------------------------------
// page-router.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import type { PageId } from '../app/pages.js';
import { PAGES } from '../app/pages.js';
import { PlaceholderPage } from './placeholder-page.js';
import { SettingsPage } from './settings-page.js';

/**
 * Pick the screen for a page.
 * @param props - The page to show.
 * @param props.page - The page id.
 * @returns The screen element.
 */
export function PageRouter(props: { readonly page: PageId }): ReactElement {
  if (props.page === 'settings') {
    return <SettingsPage />;
  }
  return <PlaceholderPage page={PAGES[props.page]} />;
}
