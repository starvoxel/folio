// ------------------------------
// top-bar.tsx
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import {
  Button,
  Dropdown,
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  Text,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components';

import { TARGET_SIZE_PX, type Interaction, type TopBarRules } from '../../layout/index.js';
import { AppIcon, type AppIconName } from './icons.js';

const LARGE_TARGET = `${String(TARGET_SIZE_PX.large)}px`;

const useStyles = makeStyles({
  bar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  identity: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    minWidth: 0,
    overflow: 'hidden',
    flexShrink: 1,
  },
  identityBelow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    columnGap: 0,
  },
  spacer: {
    flexGrow: 1,
  },
  status: {
    color: tokens.colorNeutralForeground2,
  },
  month: {
    minWidth: '160px',
  },
  // With the overflow rule the month picker takes a row of its own, so no label is squeezed.
  monthOwnRow: {
    flexBasis: '100%',
  },
  largeTarget: {
    minHeight: LARGE_TARGET,
    minWidth: LARGE_TARGET,
  },
});

/** An entry of the hamburger menu. */
export interface TopBarMenuItem {
  readonly id: string;
  readonly label: string;
  readonly testId: string;
  readonly onSelect: () => void;
}

/** A button in the command bar. */
export interface TopBarCommand {
  readonly id: string;
  readonly label: string;
  readonly icon: AppIconName;
  readonly testId: string;
  readonly onClick: () => void;
}

/** One choice of the month picker. */
export interface MonthOption {
  readonly value: string;
  readonly label: string;
}

/** The button that opens the navigation drawer, shown when the navigation is a drawer. */
export interface NavigationToggle {
  readonly label: string;
  readonly testId: string;
  readonly expanded: boolean;
  readonly onClick: () => void;
  /** Lets the shell return focus to the button when the drawer closes. */
  readonly buttonRef: (element: HTMLButtonElement | null) => void;
}

/** Properties of `TopBar`. */
export interface TopBarProps {
  readonly fileName: string;
  /** The save status next to the file name, such as "Saved automatically". */
  readonly statusText: string;
  readonly menuLabel: string;
  readonly menuTestId: string;
  readonly menuItems: readonly TopBarMenuItem[];
  readonly commands: readonly TopBarCommand[];
  readonly monthLabel: string;
  readonly monthTestId: string;
  readonly months: readonly MonthOption[];
  readonly selectedMonth: string;
  readonly onMonthChange: (value: string) => void;
  readonly fileNameTestId: string;
  readonly statusTestId: string;
  /** What the bar shows and what it moves to the overflow menu (AD-21). */
  readonly rules: TopBarRules;
  /** Touch targets need larger controls (AD-21). */
  readonly targetSize: Interaction['targetSize'];
  /** The drawer's button, or null when the navigation is always shown. */
  readonly navigationToggle: NavigationToggle | null;
}

/**
 * The top bar: file name and save status, the hamburger menu, command buttons and the month
 * picker (H1.5, H1.6a, H1.14). With the overflow rule the menu moves to the end of the bar as an
 * overflow menu and the commands, which the menu also holds, are left out of the bar.
 * @param props - The file, the menu, the commands, the month choices and the layout rules.
 * @returns The top bar element.
 */
export function TopBar(props: TopBarProps): ReactElement {
  const styles = useStyles();
  const { rules, navigationToggle } = props;
  const large = props.targetSize === 'large' ? styles.largeTarget : undefined;
  const selected = props.months.find((month) => month.value === props.selectedMonth);
  const overflow = rules.commands === 'overflow';

  const menu = (
    <Menu>
      <MenuTrigger disableButtonEnhancement>
        <Button
          appearance="subtle"
          className={mergeClasses(large)}
          icon={<AppIcon name={overflow ? 'more' : 'menu'} />}
          aria-label={props.menuLabel}
          data-testid={props.menuTestId}
        />
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          {props.menuItems.map((item) => (
            <MenuItem
              key={item.id}
              className={mergeClasses(large)}
              onClick={item.onSelect}
              data-testid={item.testId}
            >
              {item.label}
            </MenuItem>
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );

  return (
    <header className={styles.bar}>
      {navigationToggle === null ? null : (
        <Button
          ref={navigationToggle.buttonRef}
          appearance="subtle"
          className={mergeClasses(large)}
          icon={<AppIcon name="menu" />}
          aria-label={navigationToggle.label}
          aria-expanded={navigationToggle.expanded}
          onClick={navigationToggle.onClick}
          data-testid={navigationToggle.testId}
        />
      )}
      {overflow ? null : menu}
      <div
        className={mergeClasses(
          styles.identity,
          rules.status === 'below' ? styles.identityBelow : undefined,
        )}
      >
        <Text truncate wrap={false} weight="semibold" data-testid={props.fileNameTestId}>
          {props.fileName}
        </Text>
        <Text size={200} className={styles.status} data-testid={props.statusTestId}>
          {props.statusText}
        </Text>
      </div>
      <div className={styles.spacer} />
      {overflow ? menu : null}
      {overflow
        ? null
        : props.commands.map((command) => (
            <Button
              key={command.id}
              appearance="subtle"
              className={mergeClasses(large)}
              icon={<AppIcon name={command.icon} />}
              onClick={command.onClick}
              data-testid={command.testId}
            >
              {command.label}
            </Button>
          ))}
      <Dropdown
        className={mergeClasses(styles.month, overflow ? styles.monthOwnRow : undefined, large)}
        aria-label={props.monthLabel}
        value={selected?.label ?? ''}
        selectedOptions={[props.selectedMonth]}
        onOptionSelect={(_event, data) => {
          if (data.optionValue !== undefined) {
            props.onMonthChange(data.optionValue);
          }
        }}
        data-testid={props.monthTestId}
      >
        {props.months.map((month) => (
          <Option key={month.value} value={month.value}>
            {month.label}
          </Option>
        ))}
      </Dropdown>
    </header>
  );
}
