// ------------------------------
// migrations.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { err, ok } from '../support/result.js';
import { MIGRATIONS, runMigrations, type MigrationStep } from './migrations.js';

const step: MigrationStep = { from: 0, migrate: (parts) => ok({ ...parts, migrated: true }) };

describe('runMigrations', () => {
  describe('theRealChain', () => {
    it('isEmptyWhileVersion1IsADraft', () => {
      expect(MIGRATIONS).toEqual([]);
    });
  });

  describe('aFileAlreadyAtTheCurrentVersion', () => {
    it('returnsThePartsUntouched', () => {
      expect(runMigrations({ a: 1 }, 1)).toEqual(ok({ a: 1 }));
    });
  });

  describe('anOlderFileWithItsStep', () => {
    it('appliesTheStep', () => {
      expect(runMigrations({ a: 1 }, 0, [step])).toEqual(ok({ a: 1, migrated: true }));
    });
  });

  describe('anOlderFileWithNoStep', () => {
    it('failsNamingTheVersion', () => {
      expect(runMigrations({}, 0, [])).toEqual(err({ fromVersion: 0 }));
    });
  });

  describe('aStepThatFails', () => {
    it('failsNamingTheVersion', () => {
      const failing: MigrationStep = { from: 0, migrate: () => err('failed') };
      expect(runMigrations({}, 0, [failing])).toEqual(err({ fromVersion: 0 }));
    });
  });
});
