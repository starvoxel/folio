// ------------------------------
// app-shell.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';

import { makeStyles, mergeClasses } from '@fluentui/react-components';

import type { Interaction, LayoutDefinition } from '../../layout/index.js';
import { AppNavigation, type AppNavigationProps } from './app-navigation.js';
import { ShellContent } from './shell-content.js';
import { TopBar, type TopBarProps } from './top-bar.js';

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    height: '100vh',
  },
  // The left pane takes its own column beside the page; the drawer is an overlay and takes none.
  rootWithPane: {
    gridTemplateColumns: 'auto 1fr',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
  },
});

/** Properties of `AppShell`. */
export interface AppShellProps {
  /** The layout for this profile and width (AD-21): the navigation form and the rules. */
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
 * The frame of every screen (design notes, Shell). The layout picks a pane beside the page or a
 * drawer. It is one component for every layout, so page state (an open dialog, a scroll position)
 * survives a resize across a threshold (AD-21).
 * @param props - The layout, the interaction rules, the navigation, the top bar and the page.
 * @returns The shell element.
 */
export function AppShell(props: AppShellProps): ReactElement {
  const { layout, interaction, navigation, topBar, children } = props;
  const styles = useStyles();
  const drawer = layout.navigation === 'drawer';
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    // A drawer left open when the window grows must not reappear closed-then-open on shrinking.
    if (!drawer) {
      setOpen(false);
    }
  }, [drawer]);

  useEffect(() => {
    // Closing the drawer puts focus back on its button instead of dropping it to the page.
    if (wasOpen.current && !open) {
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);

  return (
    <div
      className={mergeClasses(styles.root, drawer ? undefined : styles.rootWithPane)}
      data-testid="app-shell"
      data-navigation={layout.navigation}
    >
      <AppNavigation
        {...navigation}
        targetSize={interaction.targetSize}
        onSelect={(value) => {
          setOpen(false);
          navigation.onSelect(value);
        }}
        overlay={drawer ? { open, onOpenChange: setOpen } : undefined}
      />
      <div className={styles.column}>
        <TopBar
          {...topBar}
          rules={layout.topBar}
          targetSize={interaction.targetSize}
          navigationToggle={
            drawer
              ? {
                  label: props.drawerToggleLabel,
                  testId: props.drawerToggleTestId,
                  expanded: open,
                  onClick: () => {
                    setOpen((current) => !current);
                  },
                  buttonRef: (element) => {
                    toggleRef.current = element;
                  },
                }
              : null
          }
        />
        <ShellContent rules={layout.content}>{children}</ShellContent>
      </div>
    </div>
  );
}
