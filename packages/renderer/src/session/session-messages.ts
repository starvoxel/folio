// ------------------------------
// session-messages.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { CreateFailure, OpenFailure, SaveFailure } from './file-session.js';

/** What to tell the person about a failure, and what they can do next. */
export interface FailureMessage {
  readonly title: string;
  readonly message: string;
  /** The newest backup can be opened instead (H1.11). */
  readonly offerBackup: boolean;
  /** The lock is stale, so the person may take it over after reading the message (AD-12). */
  readonly offerTakeOver: boolean;
}

const plain = (title: string, message: string): FailureMessage => ({
  title,
  message,
  offerBackup: false,
  offerTakeOver: false,
});

/**
 * Say why a file did not open. No message repeats anything from the file.
 * @param failure - The failure.
 * @returns The text and the options to offer.
 */
export function describeOpenFailure(failure: OpenFailure): FailureMessage {
  switch (failure.kind) {
    case 'locked':
      return failure.stale
        ? {
            title: 'This file was not closed properly',
            message: `It was last open on ${failure.holder} and was never released. If nobody is using it, you can take it over.`,
            offerBackup: false,
            offerTakeOver: true,
          }
        : plain(
            'This file is already open',
            `It is open on ${failure.holder}. Close it there first, so two copies do not overwrite each other.`,
          );
    case 'notFound':
      return plain('File not found', 'The file is missing or was moved.');
    case 'unreadable':
      return plain(
        'The file could not be read',
        'Folio was not allowed to read it, or the drive is not available.',
      );
    case 'invalidFile':
      return describeInvalidFile(failure);
    default:
      return assertNever(failure);
  }
}

/**
 * @param failure - A file that was read but is not a usable budget.
 * @returns The text and the options.
 */
function describeInvalidFile(
  failure: Extract<OpenFailure, { kind: 'invalidFile' }>,
): FailureMessage {
  if (failure.failure.code === 'newerFormat') {
    return plain(
      'This file needs a newer Folio',
      'It was saved by a newer version of the app. Update Folio to open it.',
    );
  }
  const offerBackup = failure.backup !== null;
  return {
    title: 'This file is damaged',
    message: offerBackup
      ? 'Folio cannot read it. The most recent backup can be opened instead.'
      : 'Folio cannot read it, and there is no backup of it on this computer.',
    offerBackup,
    offerTakeOver: false,
  };
}

/**
 * Say why a new file was not created. A cancel is not a failure and has no message.
 * @param failure - The failure.
 * @returns The text, or null for a cancel.
 */
export function describeCreateFailure(failure: CreateFailure): FailureMessage | null {
  switch (failure.kind) {
    case 'cancelled':
      return null;
    case 'locked':
      return plain(
        'That file is in use',
        `A file there is open on ${failure.holder}. Choose another name or place.`,
      );
    case 'writeFailed':
      return plain(
        'The file could not be created',
        'Choose another place, or check that the drive is available.',
      );
    default:
      return assertNever(failure);
  }
}

/**
 * Say why a save did not happen. Nothing was written in any case.
 * @param failure - The failure.
 * @returns The text and the options.
 */
export function describeSaveFailure(failure: SaveFailure): FailureMessage {
  switch (failure.kind) {
    case 'noFile':
      return plain('Nothing to save', 'No budget file is open.');
    case 'changedOnDisk':
      return plain(
        'The file changed on disk',
        'Another program or computer changed this file after you opened it. Saving would overwrite those changes, so nothing was saved.',
      );
    case 'fileGone':
      return plain(
        'The file is gone',
        'It was moved or deleted after you opened it, so nothing was saved.',
      );
    case 'failed':
      return plain(
        'The file could not be saved',
        'Nothing was changed on disk. Check that the drive is available and try again.',
      );
    default:
      return assertNever(failure);
  }
}

/**
 * Stop the build when a failure kind is not handled.
 * @param value - The unhandled value.
 * @throws {Error} Always.
 */
function assertNever(value: never): never {
  throw new Error('Unhandled failure', { cause: value });
}
