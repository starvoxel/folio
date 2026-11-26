// ------------------------------
// socket-samples.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { isLoopbackAddress, isWildcardAddress } from './addresses.js';
import type { Finding } from './findings.js';

/** A process and its parent. */
export interface ProcessRecord {
  readonly pid: number;
  readonly ppid: number;
}

/** One socket of one process, as an operating system reported it at one moment. */
export interface SocketRecord {
  readonly pid: number;
  readonly protocol: 'tcp' | 'udp';
  readonly remoteAddress: string;
  readonly remotePort: number;
  readonly state: string;
}

/** One sample of the machine: its processes and its connected sockets. */
export interface SocketSample {
  readonly processes: readonly ProcessRecord[];
  readonly sockets: readonly SocketRecord[];
}

/**
 * Split `host:port`, `[v6]:port` or `*:*` into its parts.
 * @param endpoint - An endpoint as `lsof` writes it.
 * @returns The host and the port (0 when it is a wildcard or missing).
 */
export function splitEndpoint(endpoint: string): { host: string; port: number } {
  const bracketed = /^\[(.+?)(?:%[^\]]*)?\]:(\d+|\*)$/u.exec(endpoint);
  const plain = /^(.*):(\d+|\*)$/u.exec(endpoint);
  const match = bracketed ?? plain;
  if (match === null) {
    return { host: endpoint, port: 0 };
  }
  const port = Number(match[2]);
  return { host: match[1] ?? '', port: Number.isNaN(port) ? 0 : port };
}

/**
 * Parse `lsof -nP -i -FpPnT` output (macOS). Fields come as lines tagged by their first letter:
 * `p` starts a process, `f` a file, then `P` protocol, `n` name and `T` details such as `TST=`.
 * Only sockets with a peer (`local->remote`) are kept.
 * @param text - The lsof output.
 * @returns The connected sockets.
 */
export function parseLsofSockets(text: string): SocketRecord[] {
  const sockets: SocketRecord[] = [];
  let pid = 0;
  let protocol: 'tcp' | 'udp' | undefined;
  let name = '';
  let state = '';
  const flush = (): void => {
    const peer = name.split('->')[1];
    if (protocol !== undefined && peer !== undefined) {
      const { host, port } = splitEndpoint(peer);
      sockets.push({ pid, protocol, remoteAddress: host, remotePort: port, state });
    }
    protocol = undefined;
    name = '';
    state = '';
  };
  for (const line of text.split('\n')) {
    const value = line.slice(1);
    switch (line[0]) {
      case 'p':
        flush();
        pid = Number(value);
        break;
      case 'f':
        flush();
        break;
      case 'P':
        protocol = value.toUpperCase() === 'UDP' ? 'udp' : 'tcp';
        break;
      case 'n':
        name = value;
        break;
      case 'T':
        if (value.startsWith('ST=')) {
          state = value.slice('ST='.length);
        }
        break;
      default:
        break;
    }
  }
  flush();
  return sockets;
}

/**
 * Parse `ps -axo pid=,ppid=` output (macOS).
 * @param text - The ps output, two numbers per line.
 * @returns The process records.
 */
export function parsePsProcesses(text: string): ProcessRecord[] {
  const records: ProcessRecord[] = [];
  for (const line of text.split('\n')) {
    const match = /^\s*(\d+)\s+(\d+)\s*$/u.exec(line);
    if (match !== null) {
      records.push({ pid: Number(match[1]), ppid: Number(match[2]) });
    }
  }
  return records;
}

interface WindowsRows {
  readonly processes?: unknown;
  readonly tcp?: unknown;
}

/**
 * Normalize PowerShell's `ConvertTo-Json`, which writes a single row as an object, not an array.
 * @param value - The parsed JSON value.
 * @returns The rows as an array.
 */
function rows(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value as Record<string, unknown>[];
  }
  return value === null || value === undefined ? [] : [value as Record<string, unknown>];
}

/**
 * Parse the JSON the Windows sampler script prints: `processes` (`ProcessId`, `ParentProcessId`)
 * and `tcp` (`OwningProcess`, `RemoteAddress`, `RemotePort`, `State` as text).
 * @param json - The script's output.
 * @returns The processes and TCP sockets. UDP is not listed because Windows reports no peer for it.
 */
export function parseWindowsSample(json: string): SocketSample {
  const parsed = JSON.parse(json) as WindowsRows;
  return {
    processes: rows(parsed.processes).map((row) => ({
      pid: Number(row['ProcessId']),
      ppid: Number(row['ParentProcessId']),
    })),
    sockets: rows(parsed.tcp).map((row) => ({
      pid: Number(row['OwningProcess']),
      protocol: 'tcp',
      remoteAddress: String(row['RemoteAddress']),
      remotePort: Number(row['RemotePort']),
      state: String(row['State']),
    })),
  };
}

/**
 * Find a process and everything it started, however deep.
 * @param rootPid - The process the capture launched.
 * @param processes - Every process of the machine.
 * @returns The root's pid and its descendants' pids.
 */
export function processTree(rootPid: number, processes: readonly ProcessRecord[]): Set<number> {
  const tree = new Set([rootPid]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const record of processes) {
      if (tree.has(record.ppid) && !tree.has(record.pid)) {
        tree.add(record.pid);
        grew = true;
      }
    }
  }
  return tree;
}

/**
 * Report the sockets of a process tree that are connected to a non-loopback peer. Listeners and
 * sockets without a peer are not egress.
 * @param sample - One sample of the machine.
 * @param rootPid - The process the capture launched.
 * @returns One finding per such socket.
 */
export function externalConnections(sample: SocketSample, rootPid: number): Finding[] {
  const tree = processTree(rootPid, sample.processes);
  return sample.sockets
    .filter((socket) => tree.has(socket.pid))
    .filter((socket) => !/^listen/iu.test(socket.state))
    .filter((socket) => !isWildcardAddress(socket.remoteAddress))
    .filter((socket) => !isLoopbackAddress(socket.remoteAddress))
    .map((socket) => ({
      source: 'socket-sample',
      detail: `${socket.protocol} connection to ${socket.remoteAddress}:${String(socket.remotePort)} (${socket.state || 'no state'})`,
      allowed: false,
    }));
}
