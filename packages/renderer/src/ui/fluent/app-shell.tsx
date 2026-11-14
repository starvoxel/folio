// ------------------------------
// app-shell.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement, ReactNode } from 'react';

import { makeStyles, tokens } from '@fluentui/react-components';

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
  content: {
    flexGrow: 1,
    overflow: 'auto',
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXXL,
    paddingRight: tokens.spacingHorizontalXXXL,
  },
  contentInner: {
    maxWidth: '1240px',
  },
});

/** Properties of `AppShell`. */
export interface AppShellProps {
  /** The navigation pane, on the left and the full height of the window. */
  readonly navigation: ReactNode;
  /** The top bar above the page. */
  readonly topBar: ReactNode;
  /** The current page. */
  readonly children: ReactNode;
}

/**
 * The frame of every screen: navigation on the left, a top bar, and the page below it (design
 * notes, Shell).
 * @param props - The three regions of the frame.
 * @returns The shell element.
 */
export function AppShell(props: AppShellProps): ReactElement {
  const { navigation, topBar, children } = props;
  const styles = useStyles();
  return (
    <div className={styles.root}>
      {navigation}
      <div className={styles.column}>
        {topBar}
        <main className={styles.content}>
          <div className={styles.contentInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
