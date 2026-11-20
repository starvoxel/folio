// ------------------------------
// app-navigation.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import {
  NavDrawer,
  NavDrawerBody,
  NavDrawerFooter,
  NavDrawerHeader,
  NavItem,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';

import { TARGET_SIZE_PX, type Interaction } from '../../layout/index.js';
import { AppIcon, type AppIconName } from './icons.js';

const useStyles = makeStyles({
  title: {
    paddingTop: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalM,
  },
  largeTarget: {
    minHeight: `${String(TARGET_SIZE_PX.large)}px`,
  },
});

/** One entry of the navigation pane. */
export interface AppNavigationItem {
  /** The value passed to `onSelect`. */
  readonly value: string;
  readonly label: string;
  readonly icon: AppIconName;
  /** The `data-testid` of the item. */
  readonly testId: string;
}

/** Properties of `AppNavigation`. */
export interface AppNavigationProps {
  /** The pane's heading, the product name. */
  readonly title: string;
  readonly items: readonly AppNavigationItem[];
  /** Items pinned to the bottom of the pane, such as Settings. */
  readonly footerItems: readonly AppNavigationItem[];
  /** The `value` of the selected item. */
  readonly selected: string;
  readonly onSelect: (value: string) => void;
  /** The accessible name of the navigation landmark. */
  readonly label: string;
  /** Touch targets need larger items (AD-21). */
  readonly targetSize: Interaction['targetSize'];
  /**
   * When given, the pane is an overlay that opens over the page (the drawer navigation form);
   * otherwise it is a pane beside the page that is always shown.
   */
  readonly overlay?:
    | {
        readonly open: boolean;
        readonly onOpenChange: (open: boolean) => void;
      }
    | undefined;
}

/**
 * The navigation pane (AD-15 maps the prototype's NavigationView to NavDrawer): inline beside the
 * page, or an overlay for the drawer navigation form (AD-21).
 * @param props - The items, the selection and the handler.
 * @returns The navigation pane.
 */
export function AppNavigation(props: AppNavigationProps): ReactElement {
  const { title, items, footerItems, selected, onSelect, label, targetSize, overlay } = props;
  const styles = useStyles();
  const renderItem = (item: AppNavigationItem): ReactElement => (
    <NavItem
      key={item.value}
      value={item.value}
      icon={<AppIcon name={item.icon} />}
      className={targetSize === 'large' ? mergeClasses(styles.largeTarget) : undefined}
      data-testid={item.testId}
    >
      {item.label}
    </NavItem>
  );
  return (
    <NavDrawer
      open={overlay === undefined ? true : overlay.open}
      type={overlay === undefined ? 'inline' : 'overlay'}
      onOpenChange={(_event, data) => {
        overlay?.onOpenChange(data.open);
      }}
      selectedValue={selected}
      onNavItemSelect={(_event, data) => {
        onSelect(data.value);
      }}
      aria-label={label}
    >
      <NavDrawerHeader>
        <Text as="h2" size={500} weight="semibold" className={styles.title}>
          {title}
        </Text>
      </NavDrawerHeader>
      <NavDrawerBody>{items.map(renderItem)}</NavDrawerBody>
      <NavDrawerFooter>{footerItems.map(renderItem)}</NavDrawerFooter>
    </NavDrawer>
  );
}
