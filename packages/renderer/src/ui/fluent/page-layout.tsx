// ------------------------------
// page-layout.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement, ReactNode } from 'react';

import { makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  page: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXL,
  },
  title: {
    margin: 0,
    fontSize: tokens.fontSizeBase600,
    lineHeight: tokens.lineHeightBase600,
    fontWeight: tokens.fontWeightSemibold,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXL,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow2,
  },
  cardTitle: {
    margin: 0,
    fontSize: tokens.fontSizeBase400,
    lineHeight: tokens.lineHeightBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  secondary: {
    margin: 0,
    color: tokens.colorNeutralForeground2,
  },
});

/** Properties of `Page`. */
export interface PageProps {
  readonly title: string;
  /** The `data-testid` of the page region. */
  readonly testId: string;
  readonly children: ReactNode;
}

/**
 * A page of the app: a titled region. The title is the page's only level-one heading.
 * @param props - The title, the test id and the content.
 * @returns The page element.
 */
export function Page(props: PageProps): ReactElement {
  const styles = useStyles();
  return (
    <section
      className={styles.page}
      data-testid={props.testId}
      aria-labelledby={`${props.testId}-title`}
    >
      <h1 className={styles.title} id={`${props.testId}-title`}>
        {props.title}
      </h1>
      {props.children}
    </section>
  );
}

/** Properties of `Card`. */
export interface CardProps {
  readonly title: string;
  readonly children: ReactNode;
}

/**
 * A card: a titled group of content on a raised surface (the prototype's cards and tiles).
 * @param props - The card's title and content.
 * @returns The card element.
 */
export function Card(props: CardProps): ReactElement {
  const styles = useStyles();
  return (
    <section className={styles.card} aria-label={props.title}>
      <h2 className={styles.cardTitle}>{props.title}</h2>
      {props.children}
    </section>
  );
}

/**
 * A paragraph of secondary text, for notes and hints.
 * @param props - The text.
 * @param props.children - The words to show.
 * @returns The paragraph element.
 */
export function SecondaryText(props: { readonly children: ReactNode }): ReactElement {
  const styles = useStyles();
  return <p className={styles.secondary}>{props.children}</p>;
}
