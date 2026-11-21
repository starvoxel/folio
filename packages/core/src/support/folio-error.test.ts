// ------------------------------
// folio-error.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-21
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { FolioError } from './folio-error.js';

describe('FolioError', () => {
  describe('aMessageOnly', () => {
    it('isAnErrorNamedFolioErrorWithThatMessage', () => {
      const error = new FolioError('row 12, column 3 is not an amount');
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FolioError');
      expect(error.message).toBe('row 12, column 3 is not an amount');
      expect(error.cause).toBeUndefined();
    });
  });

  describe('aCause', () => {
    it('keepsTheOriginalAsTheCause', () => {
      const original = new SyntaxError('quoted value');
      const error = new FolioError('import failed at row 4', { cause: original });
      expect(error.cause).toBe(original);
    });
  });

  describe('aSubclassThatSetsItsOwnName', () => {
    it('keepsThatName', () => {
      class ImportError extends FolioError {
        public constructor(message: string) {
          super(message);
          this.name = 'ImportError';
        }
      }
      expect(new ImportError('row 1').name).toBe('ImportError');
      expect(new ImportError('row 1')).toBeInstanceOf(FolioError);
    });
  });
});
