// ------------------------------
// shell-content.tsx
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement, ReactNode } from 'react';

import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';

import type { ContentRules, PaddingStep } from '../../layout/index.js';

const useStyles = makeStyles({
  content: {
    flexGrow: 1,
    overflow: 'auto',
  },
  compact: {
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
  },
  standard: {
    paddingTop: tokens.spacingVerticalXXL,
    paddingBottom: tokens.spacingVerticalXXL,
    paddingLeft: tokens.spacingHorizontalXXXL,
    paddingRight: tokens.spacingHorizontalXXXL,
  },
  roomy: {
    paddingTop: tokens.spacingVerticalXXXL,
    paddingBottom: tokens.spacingVerticalXXXL,
    paddingLeft: `calc(${tokens.spacingHorizontalXXXL} + ${tokens.spacingHorizontalS})`,
    paddingRight: `calc(${tokens.spacingHorizontalXXXL} + ${tokens.spacingHorizontalS})`,
  },
  // The column keeps a readable width and sits in the middle of the space, so the page looks
  // balanced at any window width or shape, ultrawide included. Nothing here depends on an aspect
  // ratio.
  column: {
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});

/** Properties of `ShellContent`. */
export interface ShellContentProps {
  readonly rules: ContentRules;
  readonly children: ReactNode;
}

/**
 * The region the page is drawn in, arranged by the layout's content rules: its padding step and
 * the widest its column gets. Pages never set either themselves (AD-21).
 * @param props - The rules and the page.
 * @returns The content region.
 */
export function ShellContent(props: ShellContentProps): ReactElement {
  const styles = useStyles();
  const padding: Readonly<Record<PaddingStep, string>> = {
    compact: styles.compact,
    standard: styles.standard,
    roomy: styles.roomy,
  };
  const { maxWidth } = props.rules;
  return (
    <main className={mergeClasses(styles.content, padding[props.rules.padding])}>
      {/* A style property is set through the CSSOM, which the content security policy allows. */}
      <div
        className={styles.column}
        style={maxWidth === null ? undefined : { maxWidth: `${String(maxWidth)}px` }}
      >
        {props.children}
      </div>
    </main>
  );
}
