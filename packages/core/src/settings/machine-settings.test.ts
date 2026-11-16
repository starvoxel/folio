// ------------------------------
// machine-settings.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { DEFAULT_MACHINE_SETTINGS, readMachineSettings } from './machine-settings.js';

describe('readMachineSettings', () => {
  describe('nothingStored', () => {
    it('returnsTheDefaults', () => {
      expect(readMachineSettings(null)).toEqual(DEFAULT_MACHINE_SETTINGS);
      expect(readMachineSettings(undefined)).toEqual(DEFAULT_MACHINE_SETTINGS);
    });
  });

  describe('validSettings', () => {
    it('returnsThem', () => {
      expect(readMachineSettings({ theme: 'dark' })).toEqual({ theme: 'dark' });
    });
  });

  describe('missingTheme', () => {
    it('fillsInTheDefault', () => {
      expect(readMachineSettings({})).toEqual({ theme: 'system' });
    });
  });

  describe('anUnknownTheme', () => {
    it('returnsTheDefaults', () => {
      expect(readMachineSettings({ theme: 'neon' })).toEqual(DEFAULT_MACHINE_SETTINGS);
    });
  });

  describe('notAnObject', () => {
    it('returnsTheDefaults', () => {
      expect(readMachineSettings('dark')).toEqual(DEFAULT_MACHINE_SETTINGS);
      expect(readMachineSettings(42)).toEqual(DEFAULT_MACHINE_SETTINGS);
    });
  });
});
