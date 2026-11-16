// ------------------------------
// action-button.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import { Button } from '@fluentui/react-components';

/** Properties of `ActionButton`. */
export interface ActionButtonProps {
  readonly label: string;
  readonly onClick: () => void;
  readonly testId: string;
  /** The primary action of a page or dialog uses `primary`; everything else is `secondary`. */
  readonly emphasis?: 'primary' | 'secondary';
}

/**
 * A button with text. Icon-only buttons need an accessible name and live in the shell components.
 * @param props - The label, the handler, the test id and the emphasis.
 * @returns The button element.
 */
export function ActionButton(props: ActionButtonProps): ReactElement {
  return (
    <Button
      appearance={props.emphasis === 'primary' ? 'primary' : 'secondary'}
      onClick={props.onClick}
      data-testid={props.testId}
    >
      {props.label}
    </Button>
  );
}
