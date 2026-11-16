// ------------------------------
// debug-guard.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { findRefusedSwitches, isAutomationEnabled } from './debug-guard.js';

describe('findRefusedSwitches', () => {
  describe('noDebuggingSwitches', () => {
    it('returnsNothing', () => {
      expect(findRefusedSwitches(['folio', '--user-data-dir=/tmp/x'], {})).toEqual([]);
    });
  });

  describe('emptyArguments', () => {
    it('returnsNothing', () => {
      expect(findRefusedSwitches([], {})).toEqual([]);
    });
  });

  describe('debuggingSwitchesWithoutAutomation', () => {
    it('returnsEveryRefusedSwitch', () => {
      const argv = [
        '--remote-debugging-pipe',
        '--remote-debugging-port=9222',
        '--remote-allow-origins=*',
        '--inspect',
        '--inspect-brk=0.0.0.0:9229',
        '--inspect-port=9230',
        '--no-sandbox',
      ];
      expect(findRefusedSwitches(argv, {})).toEqual(argv.slice(0, 6));
    });
  });

  describe('debuggingSwitchesWithAutomation', () => {
    it('returnsNothing', () => {
      expect(findRefusedSwitches(['--remote-debugging-pipe'], { FOLIO_AUTOMATION: '1' })).toEqual(
        [],
      );
    });
  });

  describe('automationSetToSomethingOtherThanOne', () => {
    it('stillRefusesTheSwitches', () => {
      for (const value of ['0', 'true', '', 'yes']) {
        expect(
          findRefusedSwitches(['--remote-debugging-pipe'], { FOLIO_AUTOMATION: value }),
        ).toEqual(['--remote-debugging-pipe']);
      }
    });
  });

  describe('aSwitchThatOnlyLooksSimilar', () => {
    it('isNotRefused', () => {
      expect(findRefusedSwitches(['--remote-debugger', '--no-inspect'], {})).toEqual([]);
    });
  });
});

describe('isAutomationEnabled', () => {
  describe('theVariableIsOne', () => {
    it('returnsTrue', () => {
      expect(isAutomationEnabled({ FOLIO_AUTOMATION: '1' })).toBe(true);
    });
  });

  describe('theVariableIsMissingOrOther', () => {
    it('returnsFalse', () => {
      expect(isAutomationEnabled({})).toBe(false);
      expect(isAutomationEnabled({ FOLIO_AUTOMATION: 'true' })).toBe(false);
    });
  });
});
