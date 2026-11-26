// ------------------------------
// strace-analyzer.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { KNOWN_NOTICE, isLoopbackAddress } from './addresses.js';
import type { Finding } from './findings.js';

/** The calls that name a destination. `bind`, `listen` and `accept` never leave the machine. */
const DESTINATION_CALLS = new Set(['connect', 'sendto', 'sendmsg', 'sendmmsg']);

const CALL_PATTERN = /^(?:\[pid\s+\d+\]\s+|\d+\s+)?(\w+)\(/u;
const INET_PATTERN =
  /sa_family=AF_INET, sin_port=htons\((\d+)\), sin_addr=inet_addr\("([^"]+)"\)/gu;
const INET6_PATTERN =
  /sa_family=AF_INET6, sin6_port=htons\((\d+)\),.*?inet_pton\(AF_INET6, "([^"]+)"/gu;

/**
 * Read `strace -f -e trace=network` output and report every destination that is not loopback.
 * Unix-domain sockets stay on the machine and are skipped. A `connect()` that fails still counts:
 * the attempt is what the privacy rule forbids.
 * @param log - The text of the strace log.
 * @returns One finding per destination named by a connect or send call.
 */
export function analyzeStrace(log: string): Finding[] {
  const findings: Finding[] = [];
  for (const line of log.split('\n')) {
    const call = CALL_PATTERN.exec(line)?.[1];
    if (call === undefined || !DESTINATION_CALLS.has(call)) {
      continue;
    }
    for (const pattern of [INET_PATTERN, INET6_PATTERN]) {
      for (const match of line.matchAll(pattern)) {
        const port = Number(match[1]);
        const address = match[2] ?? '';
        if (isLoopbackAddress(address)) {
          continue;
        }
        const known = address === KNOWN_NOTICE.address && port === KNOWN_NOTICE.port;
        findings.push({
          source: 'strace',
          detail: `${call} ${address.includes(':') ? `[${address}]` : address}:${String(port)}`,
          allowed: known,
          ...(known ? { reason: KNOWN_NOTICE.reason } : {}),
        });
      }
    }
  }
  return findings;
}
