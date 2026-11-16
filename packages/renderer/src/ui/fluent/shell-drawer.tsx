// ------------------------------
// shell-drawer.tsx
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { useEffect, useRef, useState, type ReactElement } from 'react';

import { makeStyles } from '@fluentui/react-components';

import { AppNavigation } from './app-navigation.js';
import { ShellContent } from './shell-content.js';
import type { ShellVariantProps } from './shell-left-pane.js';
import { TopBar } from './top-bar.js';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    minWidth: 0,
  },
});

/** Properties of `ShellDrawer`. */
export interface ShellDrawerProps extends ShellVariantProps {
  /** The accessible name of the button that opens the drawer. */
  readonly toggleLabel: string;
  /** The `data-testid` of that button. */
  readonly toggleTestId: string;
}

/**
 * The drawer shell: the page uses the whole width, and the navigation is an overlay that a button
 * in the top bar opens and that closes after a page is chosen.
 * @param props - The layout, the navigation, the top bar, the page and the toggle's name.
 * @returns The shell element.
 */
export function ShellDrawer(props: ShellDrawerProps): ReactElement {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    // Closing the drawer, by Escape, the backdrop or a chosen page, puts focus back on its button
    // instead of dropping it to the page.
    if (wasOpen.current && !open) {
      toggleRef.current?.focus();
    }
    wasOpen.current = open;
  }, [open]);
  const { navigation } = props;
  return (
    <div className={styles.root} data-testid="app-shell" data-navigation="drawer">
      <AppNavigation
        {...navigation}
        onSelect={(value) => {
          setOpen(false);
          navigation.onSelect(value);
        }}
        overlay={{ open, onOpenChange: setOpen }}
      />
      <TopBar
        {...props.topBar}
        navigationToggle={{
          label: props.toggleLabel,
          testId: props.toggleTestId,
          expanded: open,
          buttonRef: (element) => {
            toggleRef.current = element;
          },
          onClick: () => {
            setOpen((current) => !current);
          },
        }}
      />
      <ShellContent rules={props.layout.content}>{props.children}</ShellContent>
    </div>
  );
}
