// ------------------------------
// dns-analyzer.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { isLoopbackAddress } from './addresses.js';
import type { Finding } from './findings.js';

const QUERY_PATTERN =
  /\s(?:A|AAAA|CNAME|HTTPS|SVCB|MX|NS|PTR|SOA|SRV|TXT|ANY|TYPE\d+)\? (\S+) \(\d+\)\s*$/u;

/**
 * Read `tcpdump -nn` text and report every DNS query name. Any name counts, whichever resolver
 * it went to: inside the capture's namespace every resolver is the sink, so a query is an attempt
 * to look up an outside name.
 * @param text - The tcpdump output, one packet per line.
 * @returns One finding per query, in the order seen.
 */
export function analyzeDnsQueries(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const line of text.split('\n')) {
    const name = QUERY_PATTERN.exec(line)?.[1]?.replace(/\.$/u, '');
    if (name !== undefined && !isLoopbackAddress(name)) {
      findings.push({ source: 'dns', detail: `dns query ${name}`, allowed: false });
    }
  }
  return findings;
}
