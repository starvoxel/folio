// ------------------------------
// layout-definition.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** How the user reaches the pages. A form exists here only once a shell renders it (AD-21). */
export type NavigationForm = 'leftPane' | 'drawer';

/** The steps of space around the content, mapped to design tokens by the shell. */
export type PaddingStep = 'compact' | 'standard' | 'roomy';

/** What the top bar shows and what it moves to an overflow menu. */
export interface TopBarRules {
  /**
   * `inline` puts the menu and the commands in the bar; `overflow` moves the menu entries and the
   * commands into one overflow menu.
   */
  readonly commands: 'inline' | 'overflow';
  /** Where the save status goes: next to the file name or under it. */
  readonly status: 'beside' | 'below';
}

/** The rules for the column the page is drawn in. */
export interface ContentRules {
  /** The widest the column gets, in CSS pixels, or null for the full width. */
  readonly maxWidth: number | null;
  readonly padding: PaddingStep;
}

/**
 * Everything a shell needs to arrange itself. It says what to do, not how: the Fluent shell
 * variants turn it into markup and styles.
 */
export interface LayoutDefinition {
  readonly navigation: NavigationForm;
  readonly topBar: TopBarRules;
  readonly content: ContentRules;
}
