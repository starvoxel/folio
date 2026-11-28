// ------------------------------
// budget-document.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  applyCommand,
  createStore,
  type BudgetModel,
  type Command,
  type CommandContext,
  type CommandFailure,
  type CommandOutcome,
  type Result,
  type Store,
} from '@folio/core';

import type { FileSession, OpenedFile, SaveFailure } from './file-session.js';

/** What screens read of the open budget. */
export interface BudgetDocumentState {
  readonly model: BudgetModel;
  /** True when the model has changes the file does not have. */
  readonly dirty: boolean;
}

/**
 * The open budget (AD-1, AD-4): the model held in a store, changed only through commands, and
 * saved through the file session. Screens read the store and call `dispatch` and `save`; they
 * never see bytes.
 */
export interface BudgetDocument {
  readonly store: Store<BudgetDocumentState>;
  /** Run a command. A refused command changes nothing. */
  dispatch(command: Command): Result<CommandOutcome, CommandFailure>;
  /** Write the model to the file; the document stays dirty if it changed meanwhile or the save failed. */
  save(): Promise<Result<null, SaveFailure>>;
}

/**
 * Make the document for a file that was just opened or created.
 * @param session - The file session that holds the file.
 * @param opened - What the session returned.
 * @param context - Supplies the locked months and the checks a command needs, read on every command.
 * @returns The document, clean.
 */
export function createBudgetDocument(
  session: FileSession,
  opened: OpenedFile,
  context: () => CommandContext,
): BudgetDocument {
  const store = createStore<BudgetDocumentState>({ model: opened.model, dirty: false });
  return {
    store,
    dispatch: (command) => {
      const result = applyCommand(store.getState().model, command, context());
      if (result.ok) {
        store.setState(() => ({ model: result.value.model, dirty: true }));
      }
      return result;
    },
    save: async () => {
      const saving = store.getState().model;
      const saved = await session.save(saving);
      if (saved.ok && store.getState().model === saving) {
        store.setState((state) => ({ ...state, dirty: false }));
      }
      return saved;
    },
  };
}
