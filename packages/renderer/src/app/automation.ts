// ------------------------------
// automation.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ThemePreference } from '@folio/core';

import { navigateTo, type AppState, type AppStore } from './app-state.js';
import { FOOTER_PAGES, NAVIGATION_PAGES, PAGES, type PageId } from './pages.js';

/** The page state that tests and agents read as JSON (AD-16). It holds no financial data. */
export interface PageSnapshot {
  readonly ready: boolean;
  readonly page: PageId;
  readonly title: string;
  readonly theme: { readonly preference: ThemePreference; readonly effective: 'light' | 'dark' };
  readonly shell: {
    readonly fileName: string;
    readonly unsaved: boolean;
    readonly navItems: readonly string[];
  };
  readonly dialog: {
    readonly open: boolean;
    readonly title: string | null;
    readonly focusInside: boolean;
  };
  readonly focus: {
    readonly tag: string;
    readonly role: string | null;
    readonly label: string | null;
  };
}

/** The hook `window.__folio` that exists only when the app was started with FOLIO_AUTOMATION=1. */
export interface AutomationApi {
  /** Read the structured state of the page. */
  getState(): PageSnapshot;
  /** Show a page, as a click on its navigation item would. */
  navigate(page: PageId): void;
  /** Resolve after React has committed and the browser has painted twice. */
  settled(): Promise<void>;
}

/**
 * Describe the focused element in terms a test can compare.
 * @param doc - The document.
 * @returns The element's tag, role and label.
 */
function describeFocus(doc: Document): PageSnapshot['focus'] {
  const element = doc.activeElement;
  if (element === null) {
    return { tag: 'none', role: null, label: null };
  }
  const label = element.getAttribute('aria-label') ?? element.textContent.trim();
  return {
    tag: element.tagName.toLowerCase(),
    role: element.getAttribute('role'),
    label: label === '' ? null : label,
  };
}

/**
 * Describe the open dialog, if any, and whether focus is inside it.
 * @param doc - The document.
 * @returns The dialog part of the snapshot.
 */
function describeDialog(doc: Document): PageSnapshot['dialog'] {
  const dialog = doc.querySelector('[role="dialog"], [role="alertdialog"]');
  if (dialog === null) {
    return { open: false, title: null, focusInside: false };
  }
  const titleId = dialog.getAttribute('aria-labelledby');
  const title = titleId === null ? null : (doc.getElementById(titleId)?.textContent.trim() ?? null);
  return { open: true, title, focusInside: dialog.contains(doc.activeElement) };
}

/**
 * Build the snapshot from the app state and the document.
 * @param state - The app state.
 * @param doc - The document, for the parts only the page knows (dialog, focus, theme).
 * @returns The snapshot.
 */
export function buildSnapshot(state: AppState, doc: Document): PageSnapshot {
  const effective = doc.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light';
  return {
    ready: state.ready,
    page: state.page,
    title: PAGES[state.page].title,
    theme: { preference: state.themePreference, effective },
    shell: {
      fileName: state.fileName,
      unsaved: state.hasUnsavedChanges,
      navItems: [...NAVIGATION_PAGES, ...FOOTER_PAGES].map((page) => page.title),
    },
    dialog: describeDialog(doc),
    focus: describeFocus(doc),
  };
}

/**
 * Put the automation hook on the window. Called only when the host reports automation (AD-16).
 * @param target - The window to extend.
 * @param store - The app state.
 */
export function installAutomation(target: Window, store: AppStore): void {
  const api: AutomationApi = {
    getState: () => buildSnapshot(store.getState(), target.document),
    navigate: (page) => {
      store.setState((state) => navigateTo(state, page));
    },
    settled: () =>
      new Promise<void>((resolve) => {
        target.requestAnimationFrame(() => {
          target.requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  };
  Object.defineProperty(target, '__folio', { value: api, configurable: true });
}
