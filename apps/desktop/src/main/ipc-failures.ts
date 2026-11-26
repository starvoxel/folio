// ------------------------------
// ipc-failures.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { HostError, type HostErrorCode } from '@folio/host-api';

/** What a failed handler tells the page: a code and fixed text, never the error's own message. */
export interface IpcFailure {
  readonly code: HostErrorCode;
  readonly message: string;
}

const MESSAGES: Readonly<Record<HostErrorCode, string>> = {
  notFound: 'The file does not exist',
  permissionDenied: 'The file was not chosen in a dialog',
  unavailable: 'The host could not complete the request',
  invalid: 'The request was not valid',
};

/**
 * Describe a failure for the page. A `HostError` keeps its code, so the page can tell "gone" from
 * "refused"; everything else is `unavailable`. The text is fixed, so no path or data leaks.
 * @param error - What the handler threw.
 * @returns The code and fixed message.
 */
export function failureFor(error: unknown): IpcFailure {
  const code = error instanceof HostError ? error.code : 'unavailable';
  return { code, message: MESSAGES[code] };
}

/**
 * The failure for a request the page sent in the wrong shape.
 * @returns An `invalid` failure.
 */
export function invalidRequest(): IpcFailure {
  return { code: 'invalid', message: MESSAGES.invalid };
}
