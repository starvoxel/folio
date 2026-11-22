// ------------------------------
// dev-env.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-22
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { DEV_ENV_KEYS, applyDevEnvFile } from './dev-env.js';

describe('applyDevEnvFile', () => {
  describe('anUnpackagedRunWithAFile', () => {
    it('addsTheAllowedKeysFromTheFile', () => {
      const result = applyDevEnvFile({
        packaged: false,
        env: {},
        readText: () => '# comment\nFOLIO_LOG_LEVEL=debug\nFOLIO_LOG_UNREDACTED="1"\n',
      });
      expect(result.env['FOLIO_LOG_LEVEL']).toBe('debug');
      expect(result.env['FOLIO_LOG_UNREDACTED']).toBe('1');
      expect(result.loaded).toEqual(['FOLIO_LOG_LEVEL', 'FOLIO_LOG_UNREDACTED']);
    });
  });

  describe('aPackagedBuildWithAFile', () => {
    it('neverReadsTheFileAndChangesNothing', () => {
      let read = false;
      const result = applyDevEnvFile({
        packaged: true,
        env: { PATH: '/bin' },
        readText: () => {
          read = true;
          return 'FOLIO_LOG_LEVEL=debug\nFOLIO_LOG_UNREDACTED=1\n';
        },
      });
      expect(read).toBe(false);
      expect(result.env).toEqual({ PATH: '/bin' });
      expect(result.loaded).toEqual([]);
    });
  });

  describe('aKeyThatIsAlreadySetInTheRealEnvironment', () => {
    it('keepsTheRealValue', () => {
      const result = applyDevEnvFile({
        packaged: false,
        env: { FOLIO_LOG_LEVEL: 'error', FOLIO_LOG_UNREDACTED: '' },
        readText: () => 'FOLIO_LOG_LEVEL=debug\nFOLIO_LOG_UNREDACTED=1\n',
      });
      expect(result.env['FOLIO_LOG_LEVEL']).toBe('error');
      expect(result.env['FOLIO_LOG_UNREDACTED']).toBe('');
      expect(result.loaded).toEqual([]);
    });
  });

  describe('keysOutsideTheAllowList', () => {
    it('areIgnored', () => {
      const result = applyDevEnvFile({
        packaged: false,
        env: {},
        readText: () =>
          [
            'GOOGLE_API_KEY=secret',
            'GOOGLE_DEFAULT_CLIENT_ID=x',
            'FOLIO_AUTOMATION=1',
            'NODE_OPTIONS=--inspect',
            'ELECTRON_RUN_AS_NODE=1',
            'PATH=/evil',
            'FOLIO_LOG_LEVEL=warn',
          ].join('\n'),
      });
      expect(result.env).toEqual({ FOLIO_LOG_LEVEL: 'warn' });
      expect(result.loaded).toEqual(['FOLIO_LOG_LEVEL']);
    });
  });

  describe('noFile', () => {
    it('returnsACopyOfTheEnvironment', () => {
      const env = { FOLIO_LOG_LEVEL: 'info' };
      const result = applyDevEnvFile({ packaged: false, env, readText: () => undefined });
      expect(result.env).toEqual(env);
      expect(result.env).not.toBe(env);
      expect(result.loaded).toEqual([]);
    });
  });

  describe('aFileWithBadLinesQuotesAndComments', () => {
    it('usesTheGoodLinesAndIgnoresTheRest', () => {
      const result = applyDevEnvFile({
        packaged: false,
        env: {},
        readText: () => "this is not a setting\nFOLIO_LOG_LEVEL='debug' # why\n=oops\n\u0000\n",
      });
      expect(result.env['FOLIO_LOG_LEVEL']).toBe('debug');
    });
  });

  describe('theGivenEnvironment', () => {
    it('isNotChanged', () => {
      const env: Record<string, string | undefined> = {};
      applyDevEnvFile({ packaged: false, env, readText: () => 'FOLIO_LOG_LEVEL=debug' });
      expect(env).toEqual({});
    });
  });
});

describe('DEV_ENV_KEYS', () => {
  describe('theAllowList', () => {
    it('holdsOnlyTheLoggingSettings', () => {
      expect([...DEV_ENV_KEYS]).toEqual(['FOLIO_LOG_LEVEL', 'FOLIO_LOG_UNREDACTED']);
    });
  });
});
