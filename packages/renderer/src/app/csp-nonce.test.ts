// ------------------------------
// csp-nonce.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { readCspNonce } from './csp-nonce.js';

/**
 * Make a document whose head holds the given nonce meta content.
 * @param content - The content attribute, or null for no meta element.
 * @returns The document.
 */
function documentWithNonce(content: string | null): Document {
  const doc = document.implementation.createHTMLDocument('test');
  if (content !== null) {
    const meta = doc.createElement('meta');
    meta.name = 'folio-csp-nonce';
    meta.content = content;
    doc.head.append(meta);
  }
  return doc;
}

describe('readCspNonce', () => {
  describe('aRealNonce', () => {
    it('returnsIt', () => {
      expect(readCspNonce(documentWithNonce('abc123'))).toBe('abc123');
    });
  });

  describe('theShippedPlaceholder', () => {
    it('returnsUndefined', () => {
      expect(readCspNonce(documentWithNonce('__CSP_NONCE__'))).toBeUndefined();
    });
  });

  describe('noMetaElement', () => {
    it('returnsUndefined', () => {
      expect(readCspNonce(documentWithNonce(null))).toBeUndefined();
    });
  });

  describe('anEmptyNonce', () => {
    it('returnsUndefined', () => {
      expect(readCspNonce(documentWithNonce(''))).toBeUndefined();
    });
  });
});
