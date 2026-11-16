// ------------------------------
// app-shell.tsx
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement, ReactNode } from 'react';

import type { Interaction, LayoutDefinition } from '../../layout/index.js';
import type { AppNavigationProps } from './app-navigation.js';
import { ShellDrawer } from './shell-drawer.js';
import { ShellLeftPane } from './shell-left-pane.js';
import type { TopBarProps } from './top-bar.js';

/** Properties of `AppShell`. */
export interface AppShellProps {
  /** The layout for this profile and width (AD-21): which shell variant, and its rules. */
  readonly layout: LayoutDefinition;
  /** How controls behave for the way the user points (AD-21). */
  readonly interaction: Interaction;
  /** What the navigation shows; the shell chooses where and how. */
  readonly navigation: Omit<AppNavigationProps, 'targetSize' | 'overlay'>;
  /** What the top bar shows; the shell applies the layout's rules to it. */
  readonly topBar: Omit<TopBarProps, 'rules' | 'targetSize' | 'navigationToggle'>;
  /** The accessible name of the button that opens the navigation drawer. */
  readonly drawerToggleLabel: string;
  /** The `data-testid` of that button. */
  readonly drawerToggleTestId: string;
  /** The current page. */
  readonly children: ReactNode;
}

/**
 * The frame of every screen (design notes, Shell). It picks the shell variant the layout names and
 * hands it the rules, so how the frame is arranged is decided by the layout and nowhere else.
 * @param props - The layout, the interaction rules, the navigation, the top bar and the page.
 * @returns The shell element.
 */
export function AppShell(props: AppShellProps): ReactElement {
  const { layout, interaction, navigation, topBar, children } = props;
  const variant = {
    layout,
    navigation: { ...navigation, targetSize: interaction.targetSize },
    topBar: {
      ...topBar,
      rules: layout.topBar,
      targetSize: interaction.targetSize,
      navigationToggle: null,
    },
  };
  switch (layout.navigation) {
    case 'leftPane':
      return <ShellLeftPane {...variant}>{children}</ShellLeftPane>;
    case 'drawer':
      return (
        <ShellDrawer
          {...variant}
          toggleLabel={props.drawerToggleLabel}
          toggleTestId={props.drawerToggleTestId}
        >
          {children}
        </ShellDrawer>
      );
  }
}
