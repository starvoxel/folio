// ------------------------------
// app-state.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  createStore,
  currentMonth,
  type Clock,
  type MachineSettings,
  type Store,
  type ThemePreference,
  type YearMonth,
} from '@folio/core';

import type { PageId } from './pages.js';

/** The UI state of the app shell. It holds no financial data. */
export interface AppState {
  readonly page: PageId;
  readonly themePreference: ThemePreference;
  /** Placeholder until files can be opened: the name the top bar shows. */
  readonly fileName: string;
  readonly hasUnsavedChanges: boolean;
  /** The month the month picker shows. */
  readonly month: YearMonth;
  /** False until the machine settings have been read. */
  readonly ready: boolean;
}

/** The store that holds `AppState`. */
export type AppStore = Store<AppState>;

/**
 * Make the state the app starts in.
 * @param clock - Tells which month is current.
 * @returns The initial state.
 */
export function initialAppState(clock: Clock): AppState {
  return {
    page: 'overview',
    themePreference: 'system',
    fileName: 'Household 2026.folio',
    hasUnsavedChanges: false,
    month: currentMonth(clock),
    ready: false,
  };
}

/**
 * Make a store holding the starting state.
 * @param clock - Tells which month is current.
 * @returns The store.
 */
export function createAppStore(clock: Clock): AppStore {
  return createStore(initialAppState(clock));
}

/**
 * Show another page.
 * @param state - The current state.
 * @param page - The page to show.
 * @returns The new state; the same object when the page is already showing.
 */
export function navigateTo(state: AppState, page: PageId): AppState {
  return state.page === page ? state : { ...state, page };
}

/**
 * Change the theme choice.
 * @param state - The current state.
 * @param themePreference - The new choice.
 * @returns The new state; the same object when nothing changes.
 */
export function chooseTheme(state: AppState, themePreference: ThemePreference): AppState {
  return state.themePreference === themePreference ? state : { ...state, themePreference };
}

/**
 * Change the month the picker shows.
 * @param state - The current state.
 * @param month - The chosen month.
 * @returns The new state; the same object when nothing changes.
 */
export function chooseMonth(state: AppState, month: YearMonth): AppState {
  return state.month === month ? state : { ...state, month };
}

/**
 * Apply the machine settings once they have been read.
 * @param state - The current state.
 * @param settings - The settings read from the host.
 * @returns The new state, marked ready.
 */
export function applySettings(state: AppState, settings: MachineSettings): AppState {
  return { ...state, themePreference: settings.theme, ready: true };
}
