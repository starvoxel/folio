// ------------------------------
// socket-samples.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  externalConnections,
  parseLsofSockets,
  parsePsProcesses,
  parseWindowsSample,
  processTree,
  splitEndpoint,
  type SocketSample,
} from './socket-samples.js';

describe('splitEndpoint', () => {
  describe('theEndpointForms', () => {
    it('splitsHostAndPort', () => {
      expect(splitEndpoint('10.0.0.5:443')).toEqual({ host: '10.0.0.5', port: 443 });
      expect(splitEndpoint('[2001:db8::1]:443')).toEqual({ host: '2001:db8::1', port: 443 });
      expect(splitEndpoint('[fe80::1%en0]:123')).toEqual({ host: 'fe80::1', port: 123 });
      expect(splitEndpoint('*:*')).toEqual({ host: '*', port: 0 });
    });
  });
});

describe('parseLsofSockets', () => {
  describe('aConnectedAndAListeningSocket', () => {
    it('keepsOnlyTheConnectedOne', () => {
      const text = [
        'p100',
        'f20',
        'PTCP',
        'n127.0.0.1:50000->203.0.113.7:443',
        'TST=ESTABLISHED',
        'TQR=0',
        'f21',
        'PTCP',
        'n*:8080',
        'TST=LISTEN',
        'p200',
        'f5',
        'PUDP',
        'n10.0.0.2:5353->198.51.100.1:5353',
      ].join('\n');
      expect(parseLsofSockets(text)).toEqual([
        {
          pid: 100,
          protocol: 'tcp',
          remoteAddress: '203.0.113.7',
          remotePort: 443,
          state: 'ESTABLISHED',
        },
        { pid: 200, protocol: 'udp', remoteAddress: '198.51.100.1', remotePort: 5353, state: '' },
      ]);
    });
  });
});

describe('parsePsProcesses', () => {
  describe('psOutput', () => {
    it('readsPidAndParentPid', () => {
      expect(parsePsProcesses('  1     0\n 10     1\nbad line\n')).toEqual([
        { pid: 1, ppid: 0 },
        { pid: 10, ppid: 1 },
      ]);
    });
  });
});

describe('parseWindowsSample', () => {
  describe('aSingleRowWrittenAsAnObject', () => {
    it('isTreatedAsOneRow', () => {
      const json = JSON.stringify({
        processes: { ProcessId: 4, ParentProcessId: 0 },
        tcp: {
          OwningProcess: 4,
          RemoteAddress: '203.0.113.7',
          RemotePort: 443,
          State: 'Established',
        },
      });
      expect(parseWindowsSample(json)).toEqual({
        processes: [{ pid: 4, ppid: 0 }],
        sockets: [
          {
            pid: 4,
            protocol: 'tcp',
            remoteAddress: '203.0.113.7',
            remotePort: 443,
            state: 'Established',
          },
        ],
      });
    });
  });

  describe('emptyTables', () => {
    it('returnsEmptyLists', () => {
      expect(parseWindowsSample('{"processes":null,"tcp":null}')).toEqual({
        processes: [],
        sockets: [],
      });
    });
  });
});

describe('processTree', () => {
  describe('nestedChildren', () => {
    it('includesEveryDescendantAndNothingElse', () => {
      const processes = [
        { pid: 2, ppid: 1 },
        { pid: 3, ppid: 2 },
        { pid: 9, ppid: 8 },
      ];
      expect([...processTree(1, processes)].sort()).toEqual([1, 2, 3]);
    });
  });
});

describe('externalConnections', () => {
  const sample: SocketSample = {
    processes: [
      { pid: 2, ppid: 1 },
      { pid: 9, ppid: 8 },
    ],
    sockets: [
      { pid: 2, protocol: 'tcp', remoteAddress: '127.0.0.1', remotePort: 1, state: 'Established' },
      { pid: 2, protocol: 'tcp', remoteAddress: '0.0.0.0', remotePort: 0, state: 'Listen' },
      {
        pid: 9,
        protocol: 'tcp',
        remoteAddress: '203.0.113.7',
        remotePort: 443,
        state: 'Established',
      },
      {
        pid: 2,
        protocol: 'tcp',
        remoteAddress: '203.0.113.8',
        remotePort: 80,
        state: 'Established',
      },
    ],
  };

  describe('aMixOfSockets', () => {
    it('reportsOnlyTheAppsNonLoopbackPeers', () => {
      expect(externalConnections(sample, 1).map((finding) => finding.detail)).toEqual([
        'tcp connection to 203.0.113.8:80 (Established)',
      ]);
    });
  });
});
