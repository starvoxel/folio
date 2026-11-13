// ------------------------------
// effective-theme.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { useEffect, useSyncExternalStore } from 'react';

import type { ThemePreference } from '@folio/core';

/** The theme actually shown, after "system" has been resolved. */
export type EffectiveTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

/**
 * Listen for the system colour scheme changing.
 * @param onChange - Called after each change.
 * @returns A function that stops listening.
 */
function subscribeToSystemTheme(onChange: () => void): () => void {
  if (typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const query = window.matchMedia(DARK_QUERY);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
}

/**
 * Read whether the system prefers a dark scheme.
 * @returns True for dark; false when light or when the browser cannot say.
 */
function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Resolve the theme to show (H1.9): a fixed choice wins, "system" follows the operating system
 * and changes with it. The result is also published as `data-theme` on the root element and as
 * the page's `color-scheme`, so native controls and tests can read it.
 * @param preference - What the user chose.
 * @returns The theme in effect.
 */
export function useEffectiveTheme(preference: ThemePreference): EffectiveTheme {
  const prefersDark = useSyncExternalStore(subscribeToSystemTheme, systemPrefersDark, () => false);
  const effective: EffectiveTheme =
    preference === 'system' ? (prefersDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    document.documentElement.dataset['theme'] = effective;
    document.documentElement.style.colorScheme = effective;
  }, [effective]);
  return effective;
}
