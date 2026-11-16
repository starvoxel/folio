// ------------------------------
// confirm-dialog.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ReactElement } from 'react';

import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
} from '@fluentui/react-components';

/** Properties of `ConfirmDialog`. */
export interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  /** Called by the cancel button, by Escape and by a click outside the dialog. */
  readonly onCancel: () => void;
  /** The `data-testid` of the dialog; its buttons add `-confirm` and `-cancel`. */
  readonly testId: string;
}

/**
 * A modal confirmation: a title, a message, and a confirm and a cancel button. Focus moves into
 * the dialog while it is open, and Escape cancels.
 * @param props - The texts, the state and the handlers.
 * @returns The dialog element.
 */
export function ConfirmDialog(props: ConfirmDialogProps): ReactElement {
  return (
    <Dialog
      open={props.open}
      modalType="modal"
      onOpenChange={(_event, data) => {
        if (!data.open) {
          props.onCancel();
        }
      }}
    >
      <DialogSurface data-testid={props.testId}>
        <DialogBody>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogContent>{props.message}</DialogContent>
          <DialogActions>
            <Button
              appearance="secondary"
              onClick={props.onCancel}
              data-testid={`${props.testId}-cancel`}
            >
              {props.cancelLabel}
            </Button>
            <Button
              appearance="primary"
              onClick={props.onConfirm}
              data-testid={`${props.testId}-confirm`}
            >
              {props.confirmLabel}
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
