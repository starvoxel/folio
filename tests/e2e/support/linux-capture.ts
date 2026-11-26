// ------------------------------
// linux-capture.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { analyzeDnsQueries } from '../../../tools/privacy-capture/src/dns-analyzer.js';
import type { Finding } from '../../../tools/privacy-capture/src/findings.js';
import { analyzeStrace } from '../../../tools/privacy-capture/src/strace-analyzer.js';

/** The name the positive control looks up, so the analysis can tell it from the app's own. */
export const CONTROL_HOST = 'positive-control.invalid';
/** The address the positive control connects to (TEST-NET-1, never routable). */
export const CONTROL_ADDRESS = '192.0.2.1';

const CONTROL_SCRIPT = `
const net = require('node:net');
const dns = require('node:dns');
net.connect({ host: '${CONTROL_ADDRESS}', port: 80 }).on('error', () => {});
dns.lookup('${CONTROL_HOST}', () => {});
setTimeout(() => process.exit(0), 2000);
`;

/**
 * The command prefix that makes `strace` log every network system call of a process and all its
 * children into a file. Strings are cut at 256 bytes so socket addresses stay whole.
 * @param logFile - Where strace writes.
 * @returns The command and its arguments, ready to put in front of another command.
 */
export function straceWrapper(logFile: string): string[] {
  return ['strace', '-f', '-qq', '-e', 'trace=network', '-s', '256', '-o', logFile];
}

/** A running `tcpdump` that keeps the text of every packet header it sees. */
export interface PacketRecorder {
  /** Everything captured so far. */
  text(): string;
  /** Stop recording and return what was captured. */
  stop(): Promise<string>;
}

/**
 * Start `tcpdump` on every interface and wait until it is listening.
 * @returns The recorder.
 */
export async function startPacketRecorder(): Promise<PacketRecorder> {
  const child: ChildProcess = spawn('tcpdump', ['-nn', '-l', '-U', '-i', 'any'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let captured = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    captured += chunk.toString('utf8');
  });
  await new Promise<void>((resolve, reject) => {
    let diagnostics = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      diagnostics += chunk.toString('utf8');
      if (diagnostics.includes('listening on')) {
        resolve();
      }
    });
    child.once('error', reject);
    child.once('exit', () => {
      reject(new Error(`tcpdump exited before it listened: ${diagnostics}`));
    });
  });
  return {
    text: () => captured,
    stop: async () => {
      // Packets still in the kernel's buffer are written when tcpdump is told to stop.
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      child.kill('SIGINT');
      await once(child, 'exit');
      return captured;
    },
  };
}

/**
 * Run the positive control under the same `strace` as the app: a connection to an address that
 * goes nowhere and a lookup of a name that does not exist. If the capture cannot see these, a
 * clean result for the app means nothing.
 * @param logFile - Where strace writes the control's calls.
 * @returns The strace findings for the control.
 */
export async function runControlProcess(logFile: string): Promise<Finding[]> {
  const [command = 'strace', ...args] = straceWrapper(logFile);
  const child = spawn(command, [...args, process.execPath, '-e', CONTROL_SCRIPT], {
    stdio: 'ignore',
  });
  await once(child, 'exit');
  return analyzeStrace(await readFile(logFile, 'utf8'));
}

/** What the Linux capture concluded. */
export interface LinuxCaptureResult {
  readonly controlSeen: boolean;
  /** Findings about the app only: the control's own traffic is removed. */
  readonly findings: readonly Finding[];
}

/**
 * Combine the control's and the app's observations.
 * @param controlStrace - Findings from the control's strace log.
 * @param appStraceLog - The app's strace log.
 * @param packetText - Everything tcpdump saw during the whole run.
 * @returns Whether the control was seen on both channels, and the app's findings.
 */
export function concludeLinuxCapture(
  controlStrace: readonly Finding[],
  appStraceLog: string,
  packetText: string,
): LinuxCaptureResult {
  const dns = analyzeDnsQueries(packetText);
  const sawConnect = controlStrace.some((finding) => finding.detail.includes(CONTROL_ADDRESS));
  const sawLookup = dns.some((finding) => finding.detail.endsWith(CONTROL_HOST));
  return {
    controlSeen: sawConnect && sawLookup,
    findings: [
      ...analyzeStrace(appStraceLog),
      ...dns.filter((finding) => !finding.detail.endsWith(CONTROL_HOST)),
    ],
  };
}

/**
 * Where the capture keeps its raw logs, which the job uploads so a person can read them.
 * @param outputDirectory - The test's output folder.
 * @returns The paths of the app's and the control's strace logs and the packet text.
 */
export function captureLogPaths(outputDirectory: string): {
  app: string;
  control: string;
  packets: string;
} {
  return {
    app: join(outputDirectory, 'app.strace'),
    control: join(outputDirectory, 'control.strace'),
    packets: join(outputDirectory, 'packets.txt'),
  };
}
