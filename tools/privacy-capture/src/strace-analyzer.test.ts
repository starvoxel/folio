// ------------------------------
// strace-analyzer.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { analyzeStrace } from './strace-analyzer.js';

const v4 = (address: string, port: number): string =>
  `{sa_family=AF_INET, sin_port=htons(${String(port)}), sin_addr=inet_addr("${address}")}`;
const v6 = (address: string, port: number): string =>
  `{sa_family=AF_INET6, sin6_port=htons(${String(port)}), sin6_flowinfo=htonl(0), inet_pton(AF_INET6, "${address}", &sin6_addr), sin6_scope_id=0}`;

describe('analyzeStrace', () => {
  describe('loopbackAndUnixSockets', () => {
    it('reportsNothing', () => {
      const log = [
        `812 connect(3, ${v4('127.0.0.1', 9222)}, 16) = 0`,
        `812 connect(4, ${v6('::1', 80)}, 28) = 0`,
        '812 connect(5, {sa_family=AF_UNIX, sun_path="/run/dbus/system_bus_socket"}, 29) = -1 ENOENT',
        '812 socket(AF_INET, SOCK_STREAM, IPPROTO_IP) = 6',
      ].join('\n');
      expect(analyzeStrace(log)).toEqual([]);
    });
  });

  describe('anOutsideConnect', () => {
    it('reportsItEvenWhenItFails', () => {
      const log = `901 connect(7, ${v4('203.0.113.9', 443)}, 16) = -1 ENETUNREACH (Network is unreachable)`;
      expect(analyzeStrace(log)).toEqual([
        { source: 'strace', detail: 'connect 203.0.113.9:443', allowed: false },
      ]);
    });
  });

  describe('anUnfinishedCall', () => {
    it('stillReportsTheDestination', () => {
      const log = `901 connect(7, ${v4('203.0.113.9', 53)}, 16 <unfinished ...>\n901 <... connect resumed>) = 0`;
      expect(analyzeStrace(log).map((finding) => finding.detail)).toEqual([
        'connect 203.0.113.9:53',
      ]);
    });
  });

  describe('anUnconnectedSend', () => {
    it('reportsTheDestinationOfSendto', () => {
      const log = `5 sendto(8, "x", 1, MSG_NOSIGNAL, ${v4('198.51.100.2', 53)}, 16) = 1`;
      expect(analyzeStrace(log).map((finding) => finding.detail)).toEqual([
        'sendto 198.51.100.2:53',
      ]);
    });
  });

  describe('theKnownIpv6Probe', () => {
    it('isAllowedWithAReason', () => {
      const log = `44 connect(9, ${v6('2001:4860:4860::8888', 443)}, 28) = 0`;
      const [finding] = analyzeStrace(log);
      expect(finding).toMatchObject({
        detail: 'connect [2001:4860:4860::8888]:443',
        allowed: true,
      });
      expect(finding?.reason).toContain('IPv6 reachability');
    });
  });

  describe('theProbeAddressOnAnotherPort', () => {
    it('isNotAllowed', () => {
      const log = `44 connect(9, ${v6('2001:4860:4860::8888', 53)}, 28) = 0`;
      expect(analyzeStrace(log)[0]?.allowed).toBe(false);
    });
  });
});
