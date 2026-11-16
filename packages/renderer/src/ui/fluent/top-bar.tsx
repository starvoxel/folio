// ------------------------------
// top-bar.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
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
  tokens,
} from '@fluentui/react-components';

import { AppIcon, type AppIconName } from './icons.js';

const useStyles = makeStyles({
  bar: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
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
}

/**
 * The top bar: hamburger menu, file name and save status, command buttons and the month picker
 * (H1.5, H1.6a, H1.14).
 * @param props - The file, the menu, the commands and the month choices.
 * @returns The top bar element.
 */
export function TopBar(props: TopBarProps): ReactElement {
  const styles = useStyles();
  const selected = props.months.find((month) => month.value === props.selectedMonth);
  return (
    <header className={styles.bar}>
      <Menu>
        <MenuTrigger disableButtonEnhancement>
          <Button
            appearance="subtle"
            icon={<AppIcon name="menu" />}
            aria-label={props.menuLabel}
            data-testid={props.menuTestId}
          />
        </MenuTrigger>
        <MenuPopover>
          <MenuList>
            {props.menuItems.map((item) => (
              <MenuItem key={item.id} onClick={item.onSelect} data-testid={item.testId}>
                {item.label}
              </MenuItem>
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
      <Text weight="semibold" data-testid={props.fileNameTestId}>
        {props.fileName}
      </Text>
      <Text size={200} className={styles.status} data-testid={props.statusTestId}>
        {props.statusText}
      </Text>
      <div className={styles.spacer} />
      {props.commands.map((command) => (
        <Button
          key={command.id}
          appearance="subtle"
          icon={<AppIcon name={command.icon} />}
          onClick={command.onClick}
          data-testid={command.testId}
        >
          {command.label}
        </Button>
      ))}
      <Dropdown
        className={styles.month}
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
