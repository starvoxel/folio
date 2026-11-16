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

/**
 * The page-coloured surface the app draws on. It is a component of its own because a style hook
 * uses the style engine of the nearest provider: called in `AppRoot` itself, above the provider
 * that `AppRoot` renders, it would use the default engine, whose style elements carry no CSP
 * nonce and are blocked.
 * @param props - The content.
 * @param props.children - What to draw on the surface.
 * @returns The surface element.
 */
function Surface(props: { readonly children: ReactNode }): ReactElement {
  const styles = useStyles();
  return <div className={styles.root}>{props.children}</div>;
}

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
        <Surface>{children}</Surface>
      </FluentProvider>
    </RendererProvider>
  );
}
