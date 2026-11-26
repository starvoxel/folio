// ------------------------------
// ipc-failures.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { HostError } from '@folio/host-api';

import { failureFor, invalidRequest } from './ipc-failures.js';

describe('failureFor', () => {
  describe('aHostError', () => {
    it('keepsItsCodeAndUsesFixedText', () => {
      expect(failureFor(new HostError('notFound', '/secret/path.folio is missing'))).toEqual({
        code: 'notFound',
        message: 'The file does not exist',
      });
    });
  });

  describe('anyOtherError', () => {
    it('becomesUnavailableWithoutItsMessage', () => {
      const failure = failureFor(new Error('EACCES /home/me/budget.folio'));
      expect(failure.code).toBe('unavailable');
      expect(failure.message).not.toContain('home');
    });
  });
});

describe('invalidRequest', () => {
  describe('always', () => {
    it('hasTheInvalidCode', () => {
      expect(invalidRequest().code).toBe('invalid');
    });
  });
});
