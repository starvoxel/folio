// ------------------------------
// shell-left-pane.tsx
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement, ReactNode } from 'react';

import { makeStyles } from '@fluentui/react-components';

import type { LayoutDefinition } from '../../layout/index.js';
import { AppNavigation, type AppNavigationProps } from './app-navigation.js';
import { ShellContent } from './shell-content.js';
import { TopBar, type TopBarProps } from './top-bar.js';

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    height: '100vh',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
  },
});

/** Properties of the shell variants. */
export interface ShellVariantProps {
  readonly layout: LayoutDefinition;
  readonly navigation: AppNavigationProps;
  readonly topBar: TopBarProps;
  readonly children: ReactNode;
}

/**
 * The left-pane shell: the navigation pane beside the page for the full height of the window,
 * the top bar and the page in the column next to it (design notes, Shell).
 * @param props - The layout, the navigation, the top bar and the page.
 * @returns The shell element.
 */
export function ShellLeftPane(props: ShellVariantProps): ReactElement {
  const styles = useStyles();
  return (
    <div className={styles.root} data-testid="app-shell" data-navigation="leftPane">
      <AppNavigation {...props.navigation} />
      <div className={styles.column}>
        <TopBar {...props.topBar} navigationToggle={null} />
        <ShellContent rules={props.layout.content}>{props.children}</ShellContent>
      </div>
    </div>
  );
}
