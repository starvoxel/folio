// ------------------------------
// addresses.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Chromium's IPv6 reachability check: a UDP `connect()` to a public Google DNS address that sends
 * no packet. It is the only allowed notice (AD-18); a feature that makes requests adds to this.
 */
export const KNOWN_NOTICE = {
  address: '2001:4860:4860::8888',
  port: 443,
  reason: 'Chromium IPv6 reachability check (AD-18 known notice); no packet is sent',
} as const;

/**
 * Tell whether an address stays on this machine.
 * @param address - An IPv4 or IPv6 address, or a host name, without a port.
 * @returns True for 127.0.0.0/8, `::1`, their IPv4-mapped form and `localhost`.
 */
export function isLoopbackAddress(address: string): boolean {
  const lower = address.toLowerCase().replace(/^\[|\]$/gu, '');
  const mapped = lower.startsWith('::ffff:') ? lower.slice('::ffff:'.length) : lower;
  return (
    mapped === '::1' || mapped === 'localhost' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u.test(mapped)
  );
}

/**
 * Tell whether an address means "no peer": a listener or an unconnected socket.
 * @param address - The remote address a socket table reports.
 * @returns True for empty, `*`, `0.0.0.0` and `::`.
 */
export function isWildcardAddress(address: string): boolean {
  return ['', '*', '0.0.0.0', '::', '[::]'].includes(address);
}
