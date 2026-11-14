// ------------------------------
// csp-nonce.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

const PLACEHOLDER = '__CSP_NONCE__';

/**
 * Read the content security policy nonce the desktop protocol handler put in the page (AD-18).
 * The placeholder that ships in `index.html` counts as no nonce, so a development server or a
 * test page gets none.
 * @param doc - The document to read.
 * @returns The nonce, or undefined when the page has none.
 */
export function readCspNonce(doc: Document): string | undefined {
  const content = doc.querySelector('meta[name="folio-csp-nonce"]')?.getAttribute('content');
  if (content === null || content === undefined || content === '' || content === PLACEHOLDER) {
    return undefined;
  }
  return content;
}
