// ------------------------------
// app-origin.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { describeUrlForLog, isAllowedRequest, isAppUrl } from './app-origin.js';

describe('isAppUrl', () => {
  describe('aPageOfTheApp', () => {
    it('returnsTrue', () => {
      expect(isAppUrl('folio://app/')).toBe(true);
      expect(isAppUrl('folio://app/assets/index.js')).toBe(true);
    });
  });

  describe('anotherHostOrScheme', () => {
    it('returnsFalse', () => {
      expect(isAppUrl('folio://other/')).toBe(false);
      expect(isAppUrl('https://app/')).toBe(false);
      expect(isAppUrl('folio://app.evil.example/')).toBe(false);
      expect(isAppUrl('')).toBe(false);
    });
  });
});

describe('isAllowedRequest', () => {
  describe('theAllowedSchemes', () => {
    it('returnsTrue', () => {
      for (const url of [
        'folio://app/x.js',
        'devtools://devtools/',
        'data:text/plain,x',
        'blob:abc',
      ]) {
        expect(isAllowedRequest(url)).toBe(true);
      }
    });
  });

  describe('anythingElse', () => {
    it('returnsFalse', () => {
      for (const url of [
        'https://example.com/',
        'http://127.0.0.1:9222/',
        'file:///etc/passwd',
        'ws://localhost/',
        'ftp://x/',
        'chrome://gpu',
      ]) {
        expect(isAllowedRequest(url)).toBe(false);
      }
    });
  });
});

describe('describeUrlForLog', () => {
  describe('aUrlWithPathAndQuery', () => {
    it('keepsOnlySchemeAndHost', () => {
      expect(describeUrlForLog('https://example.com/a/b?secret=1')).toBe('https://example.com');
    });
  });

  describe('notAUrl', () => {
    it('returnsAFixedPlaceholder', () => {
      expect(describeUrlForLog('not a url')).toBe('unparseable-url');
    });
  });
});
