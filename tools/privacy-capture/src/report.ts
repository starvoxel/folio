// ------------------------------
// report.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { distinctFindings, hasFailures, type Finding } from './findings.js';

/** What a runner cannot show, stated in every Windows and macOS report so green is not over-read. */
export const SAMPLER_LIMITS = [
  'Sockets are read once a second: a connection that opens and closes between two samples is missed.',
  'Windows lists no peer for UDP endpoints, so UDP traffic to an outside address is not visible there.',
  'DNS lookups made by a system resolver service on behalf of the app are not attributed to the app.',
  'Only the app and its descendants are watched; a helper another service starts for it is not.',
] as const;

/** The parts of a capture report. */
export interface ReportInput {
  readonly title: string;
  /** True when the positive control was seen, so the capture is known to detect a connection. */
  readonly controlSeen: boolean;
  readonly findings: readonly Finding[];
  /** Plain lines about what this capture could not observe. */
  readonly limits?: readonly string[];
}

/**
 * Write a capture report as Markdown for the job summary. A person reads it on every Electron
 * update, so notices are listed too, not only failures.
 * @param input - The control result, the findings and the stated limits.
 * @returns Markdown text.
 */
export function renderReport(input: ReportInput): string {
  const findings = distinctFindings(input.findings);
  const failed = !input.controlSeen || hasFailures(findings);
  const lines = [`## ${input.title}: ${failed ? 'FAILED' : 'passed'}`, ''];
  lines.push(
    input.controlSeen
      ? '- Positive control: seen, so the capture detects a connection.'
      : '- Positive control: NOT seen. The capture is blind, so its result means nothing.',
  );
  const blocking = findings.filter((finding) => !finding.allowed);
  const notices = findings.filter((finding) => finding.allowed);
  lines.push(`- Outbound attempts by the app: ${String(blocking.length)}`);
  for (const finding of blocking) {
    lines.push(`  - ${finding.source}: ${finding.detail}`);
  }
  lines.push(`- Allowed notices: ${String(notices.length)}`);
  for (const finding of notices) {
    lines.push(`  - ${finding.source}: ${finding.detail} (${finding.reason ?? 'allowed'})`);
  }
  for (const limit of input.limits ?? []) {
    lines.push(`- Cannot observe: ${limit}`);
  }
  return `${lines.join('\n')}\n`;
}
