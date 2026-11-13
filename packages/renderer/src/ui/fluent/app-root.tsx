// ------------------------------
// app-root.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { type ReactElement, type ReactNode, useEffect, useMemo } from 'react';

import {
  FluentProvider,
  RendererProvider,
  createDOMRenderer,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

import type { ThemePreference } from '@folio/core';

import { useEffectiveTheme } from './effective-theme.js';
import { darkTheme, lightTheme } from './theme.js';

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
});

/** Properties of `AppRoot`. */
export interface AppRootProps {
  /** What the user chose: light, dark or follow the system. */
  readonly themePreference: ThemePreference;
  /**
   * The nonce the content security policy allows for style elements, or undefined when the page
   * has none (a development server, a test).
   */
  readonly cspNonce: string | undefined;
  readonly children: ReactNode;
}

/**
 * The root of the app's UI: applies the theme (AD-15) and gives Fluent's style engine the CSP
 * nonce, so its style elements pass the strict content security policy (AD-18).
 * @param props - The theme choice, the nonce and the content.
 * @returns The themed root element.
 */
export function AppRoot(props: AppRootProps): ReactElement {
  const { themePreference, cspNonce, children } = props;
  const styles = useStyles();
  const effective = useEffectiveTheme(themePreference);
  useEffect(() => {
    // The browser's default 8px page margin would frame the shell; setting it through the CSSOM
    // is allowed by the strict content security policy, an inline style element would not be.
    document.body.style.margin = '0';
  }, []);
  const renderer = useMemo(
    () =>
      createDOMRenderer(
        document,
        cspNonce === undefined ? undefined : { styleElementAttributes: { nonce: cspNonce } },
      ),
    [cspNonce],
  );
  return (
    <RendererProvider renderer={renderer} targetDocument={document}>
      {/* The styles go on an inner element, not on FluentProvider: Fluent copies a provider's
          class name onto the portal element that holds menus and dropdown lists, and a full-height
          background there would cover the page and swallow every click. */}
      <FluentProvider
        theme={effective === 'dark' ? darkTheme : lightTheme}
        targetDocument={document}
      >
        <div className={styles.root}>{children}</div>
      </FluentProvider>
    </RendererProvider>
  );
}
