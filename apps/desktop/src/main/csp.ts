// ------------------------------
// csp.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Build the content security policy of the app page (AD-18). Nothing loads from outside the app's
 * own origin, scripts only from files, no network connections, no frames, no plug-ins. Style
 * elements need the per-load nonce because the UI library inserts them at run time.
 * @param nonce - The nonce for this page load.
 * @returns The policy as a header value.
 */
export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'none'",
    "script-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}
