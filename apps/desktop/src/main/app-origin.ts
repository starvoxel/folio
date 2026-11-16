// ------------------------------
// app-origin.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The custom protocol the UI is served from, instead of file:// (AD-18). */
export const APP_SCHEME = 'folio';

/** The address of the app page. */
export const APP_ORIGIN = `${APP_SCHEME}://app/`;

/**
 * Tell whether a URL belongs to the app page.
 * @param url - The URL to test.
 * @returns True when it is under the app origin.
 */
export function isAppUrl(url: string): boolean {
  return url.startsWith(APP_ORIGIN);
}

/**
 * Tell whether a request may go out at all: the app protocol, the developer tools, and `data:`
 * and `blob:` URLs, which never leave the process (AD-18). Everything else is denied.
 * @param url - The requested URL.
 * @returns True when the request is allowed.
 */
export function isAllowedRequest(url: string): boolean {
  return (
    isAppUrl(url) ||
    url.startsWith('devtools://') ||
    url.startsWith('data:') ||
    url.startsWith('blob:')
  );
}

/**
 * Describe a URL for a log line without its path or query, which can carry data.
 * @param url - The URL.
 * @returns The scheme and host only.
 */
export function describeUrlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return 'unparseable-url';
  }
}
