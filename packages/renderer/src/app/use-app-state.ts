// ------------------------------
// use-app-state.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { useSyncExternalStore } from 'react';

import type { AppState, AppStore } from './app-state.js';

/**
 * Read the app state and re-render when it changes (AD-14: components read the core store
 * through `useSyncExternalStore`).
 * @param store - The store to read.
 * @returns The current state.
 */
export function useAppState(store: AppStore): AppState {
  return useSyncExternalStore(store.subscribe, store.getState);
}
