// ------------------------------
// session-messages.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import type { FileRef } from '@folio/host-api';

import type { OpenFailure } from './file-session.js';
import {
  describeCreateFailure,
  describeOpenFailure,
  describeSaveFailure,
} from './session-messages.js';

const backup: FileRef = { path: '/backups/a.folio', name: 'a.folio' };

describe('describeOpenFailure', () => {
  describe('aFileHeldByALiveHolder', () => {
    it('namesTheHolderAndOffersNothing', () => {
      const message = describeOpenFailure({ kind: 'locked', holder: 'LAPTOP', stale: false });
      expect(message.message).toContain('LAPTOP');
      expect([message.offerBackup, message.offerTakeOver]).toEqual([false, false]);
    });
  });

  describe('aStaleLock', () => {
    it('offersTakeOver', () => {
      const message = describeOpenFailure({ kind: 'locked', holder: 'LAPTOP', stale: true });
      expect(message.offerTakeOver).toBe(true);
    });
  });

  describe('aDamagedFileWithABackup', () => {
    it('offersTheBackup', () => {
      const failure: OpenFailure = {
        kind: 'invalidFile',
        failure: { code: 'checksumMismatch', part: 'accounts' },
        backup,
      };
      expect(describeOpenFailure(failure)).toMatchObject({
        title: 'This file is damaged',
        offerBackup: true,
      });
    });
  });

  describe('aDamagedFileWithNoBackup', () => {
    it('saysThereIsNoBackup', () => {
      const failure: OpenFailure = {
        kind: 'invalidFile',
        failure: { code: 'notAZip' },
        backup: null,
      };
      const message = describeOpenFailure(failure);
      expect(message.offerBackup).toBe(false);
      expect(message.message).toContain('no backup');
    });
  });

  describe('aNewerFormat', () => {
    it('asksForAnUpdateAndOffersNoBackup', () => {
      const message = describeOpenFailure({
        kind: 'invalidFile',
        failure: { code: 'newerFormat', formatVersion: 9 },
        backup: null,
      });
      expect(message.title).toBe('This file needs a newer Folio');
      expect(message.offerBackup).toBe(false);
    });
  });

  describe('aMissingOrUnreadableFile', () => {
    it('hasItsOwnTitle', () => {
      expect(describeOpenFailure({ kind: 'notFound' }).title).toBe('File not found');
      expect(describeOpenFailure({ kind: 'unreadable' }).title).toBe('The file could not be read');
    });
  });

  describe('everyFailure', () => {
    it('repeatsNothingFromTheFileInTheText', () => {
      const failure: OpenFailure = {
        kind: 'invalidFile',
        failure: {
          code: 'schemaInvalid',
          part: 'accounts',
          issues: [{ path: '0.name', message: 'SecretMerchant' }],
        },
        backup,
      };
      expect(JSON.stringify(describeOpenFailure(failure))).not.toContain('SecretMerchant');
      expect(JSON.stringify(describeOpenFailure(failure))).not.toContain('accounts');
    });
  });
});

describe('describeCreateFailure', () => {
  describe('aCancel', () => {
    it('hasNoMessage', () => {
      expect(describeCreateFailure({ kind: 'cancelled' })).toBeNull();
    });
  });

  describe('aLockedOrFailedCreate', () => {
    it('hasAMessage', () => {
      expect(describeCreateFailure({ kind: 'locked', holder: 'PC', stale: false })?.title).toBe(
        'That file is in use',
      );
      expect(describeCreateFailure({ kind: 'writeFailed' })?.title).toBe(
        'The file could not be created',
      );
    });
  });
});

describe('describeSaveFailure', () => {
  describe('everyKind', () => {
    it('saysNothingWasSaved', () => {
      for (const kind of ['changedOnDisk', 'fileGone', 'failed'] as const) {
        const text = describeSaveFailure({ kind }).message.toLowerCase();
        expect(text).toMatch(/nothing/u);
      }
      expect(describeSaveFailure({ kind: 'noFile' }).title).toBe('Nothing to save');
    });
  });
});
