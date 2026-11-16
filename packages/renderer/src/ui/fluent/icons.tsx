// ------------------------------
// icons.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import {
  ArrowImport24Regular,
  ArrowRedo24Regular,
  ArrowTrendingLines24Regular,
  ArrowUndo24Regular,
  BuildingBank24Regular,
  Home24Regular,
  Navigation24Regular,
  Receipt24Regular,
  Settings24Regular,
  TextBulletListSquare24Regular,
  DataPie24Regular,
} from '@fluentui/react-icons';

/** The icons the app shell uses, by what they mean. */
export type AppIconName =
  | 'overview'
  | 'transactions'
  | 'reporting'
  | 'netWorth'
  | 'accounts'
  | 'rules'
  | 'settings'
  | 'menu'
  | 'undo'
  | 'redo'
  | 'import';

/**
 * Draw one of the app's icons. Icons are decorative here: the control that holds one carries the
 * accessible name.
 * @param props - Which icon to draw.
 * @param props.name - The icon's meaning.
 * @returns The icon element.
 */
export function AppIcon(props: { readonly name: AppIconName }): ReactElement {
  switch (props.name) {
    case 'overview':
      return <Home24Regular aria-hidden />;
    case 'transactions':
      return <Receipt24Regular aria-hidden />;
    case 'reporting':
      return <DataPie24Regular aria-hidden />;
    case 'netWorth':
      return <ArrowTrendingLines24Regular aria-hidden />;
    case 'accounts':
      return <BuildingBank24Regular aria-hidden />;
    case 'rules':
      return <TextBulletListSquare24Regular aria-hidden />;
    case 'settings':
      return <Settings24Regular aria-hidden />;
    case 'menu':
      return <Navigation24Regular aria-hidden />;
    case 'undo':
      return <ArrowUndo24Regular aria-hidden />;
    case 'redo':
      return <ArrowRedo24Regular aria-hidden />;
    case 'import':
      return <ArrowImport24Regular aria-hidden />;
  }
}
