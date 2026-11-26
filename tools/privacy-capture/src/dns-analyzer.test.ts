// ------------------------------
// dns-analyzer.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { analyzeDnsQueries } from './dns-analyzer.js';

describe('analyzeDnsQueries', () => {
  describe('noDnsTraffic', () => {
    it('reportsNothing', () => {
      expect(
        analyzeDnsQueries(
          '12:00:00.1 lo In IP 127.0.0.1.4000 > 127.0.0.1.9222: Flags [P.], length 10',
        ),
      ).toEqual([]);
    });
  });

  describe('anAQueryAndAnAaaaQuery', () => {
    it('reportsEachNameWithoutTheTrailingDot', () => {
      const text = [
        '12:00:00.1 sink0 Out IP 10.99.0.1.50000 > 10.99.0.2.53: 3341+ A? dl.example.com. (32)',
        '12:00:00.2 sink0 Out IP 10.99.0.1.50001 > 10.99.0.2.53: 3342+ [1au] AAAA? dl.example.com. (43)',
      ].join('\n');
      expect(analyzeDnsQueries(text).map((finding) => finding.detail)).toEqual([
        'dns query dl.example.com',
        'dns query dl.example.com',
      ]);
    });
  });

  describe('aResponse', () => {
    it('isNotCountedAsAQuery', () => {
      const text =
        '12:00:00.3 sink0 In IP 10.99.0.2.53 > 10.99.0.1.50000: 3341 NXDomain 0/0/0 (32)';
      expect(analyzeDnsQueries(text)).toEqual([]);
    });
  });

  describe('aLocalhostLookup', () => {
    it('isIgnored', () => {
      const text = '12:00:00.1 lo In IP 10.99.0.1.1 > 10.99.0.2.53: 1+ A? localhost. (27)';
      expect(analyzeDnsQueries(text)).toEqual([]);
    });
  });
});
