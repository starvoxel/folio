// ------------------------------
// findings.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** Which observation produced a finding. */
export type FindingSource = 'strace' | 'dns' | 'socket-sample';

/** One outbound attempt the capture saw. */
export interface Finding {
  readonly source: FindingSource;
  /** What was seen, such as `connect 10.0.0.1:443`, without any payload. */
  readonly detail: string;
  /** True for the one known notice (AD-18); it is reported but does not fail the run. */
  readonly allowed: boolean;
  /** Why an allowed finding is allowed. */
  readonly reason?: string;
}

/**
 * Tell whether any finding fails the capture.
 * @param findings - Everything the analyzers reported.
 * @returns True when at least one finding is not allowed.
 */
export function hasFailures(findings: readonly Finding[]): boolean {
  return findings.some((finding) => !finding.allowed);
}

/**
 * Drop repeated findings, keeping the first of each, so a long idle run stays readable.
 * @param findings - Findings in the order they were seen.
 * @returns The distinct findings.
 */
export function distinctFindings(findings: readonly Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];
  for (const finding of findings) {
    const key = `${finding.source}|${finding.detail}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(finding);
    }
  }
  return result;
}
