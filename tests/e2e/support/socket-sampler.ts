// ------------------------------
// socket-sampler.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { execFile, spawn } from 'node:child_process';
import { createServer, type Server } from 'node:net';
import { networkInterfaces } from 'node:os';
import { promisify } from 'node:util';

import type { Finding } from '../../../tools/privacy-capture/src/findings.js';
import {
  externalConnections,
  parseLsofSockets,
  parsePsProcesses,
  parseWindowsSample,
  type SocketSample,
} from '../../../tools/privacy-capture/src/socket-samples.js';

const run = promisify(execFile);
const MAX_OUTPUT = 32 * 1024 * 1024;

const WINDOWS_SCRIPT = `
$ErrorActionPreference = 'Stop'
$processes = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId
$tcp = Get-NetTCPConnection | Select-Object OwningProcess, RemoteAddress, RemotePort, @{ n = 'State'; e = { $_.State.ToString() } }
@{ processes = @($processes); tcp = @($tcp) } | ConvertTo-Json -Compress -Depth 4
`;

/**
 * Read the machine's processes and connected sockets once, with the operating system's own tools.
 * @returns The sample.
 * @throws {Error} On a platform without a sampler.
 */
export async function takeSample(): Promise<SocketSample> {
  if (process.platform === 'win32') {
    const { stdout } = await run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', WINDOWS_SCRIPT],
      { maxBuffer: MAX_OUTPUT },
    );
    return parseWindowsSample(stdout);
  }
  if (process.platform === 'darwin') {
    const processes = await run('ps', ['-axo', 'pid=,ppid='], { maxBuffer: MAX_OUTPUT });
    // lsof exits 1 when it lists nothing, which is not a failure here.
    const sockets = await run('lsof', ['-nP', '-i', '-FpPnT'], { maxBuffer: MAX_OUTPUT }).catch(
      (error: unknown) => ({ stdout: (error as { stdout?: string }).stdout ?? '' }),
    );
    return {
      processes: parsePsProcesses(processes.stdout),
      sockets: parseLsofSockets(sockets.stdout),
    };
  }
  throw new Error(`No socket sampler for ${process.platform}`);
}

/**
 * Sample once a second until a time is reached or the caller's condition says stop.
 * @param rootPid - The process whose tree is watched.
 * @param until - The time to stop at, in milliseconds since the epoch.
 * @param found - Receives every external connection seen.
 * @param stopWhen - Optional early stop.
 * @returns The number of samples taken.
 */
export async function sampleUntil(
  rootPid: number,
  until: number,
  found: Finding[],
  stopWhen: () => boolean = () => false,
): Promise<number> {
  let samples = 0;
  while (Date.now() < until && !stopWhen()) {
    found.push(...externalConnections(await takeSample(), rootPid));
    samples += 1;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return samples;
}

/**
 * The address another machine would use to reach this one. A connection to it is a non-loopback
 * connection even though it never leaves the runner.
 * @returns The first non-loopback IPv4 address.
 * @throws {Error} When the machine has none.
 */
export function ownExternalAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    const found = addresses?.find((entry) => entry.family === 'IPv4' && !entry.internal);
    if (found !== undefined) {
      return found.address;
    }
  }
  throw new Error('This machine has no non-loopback IPv4 address for the positive control');
}

/**
 * The positive control for the samplers: a process whose child connects to this machine's own
 * non-loopback address and holds the connection. The sampler must see it. A navigation by the app
 * itself cannot serve as the control, because the app refuses every outside request (AD-18).
 * @returns Whether the sampler saw the connection, and what it saw.
 */
export async function runSamplerControl(): Promise<{ seen: boolean; findings: Finding[] }> {
  const address = ownExternalAddress();
  const server: Server = createServer((socket) => {
    socket.on('error', () => undefined);
  });
  await new Promise<void>((resolve) => server.listen(0, '0.0.0.0', resolve));
  const port = (server.address() as { port: number }).port;
  // The connection is made by a grandchild of the process the sampler watches, the way Chromium's
  // web processes are descendants of the app, so the control also proves the tree walk.
  const grandchild = `const s = require('node:net').connect(${String(port)}, '${address}'); s.on('error', () => {}); setTimeout(() => process.exit(0), 15000);`;
  const child = spawn(
    process.execPath,
    [
      '-e',
      `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'ignore' }); setTimeout(() => process.exit(0), 15000);`,
    ],
    { stdio: 'ignore' },
  );
  const findings: Finding[] = [];
  try {
    if (child.pid === undefined) {
      throw new Error('The control process did not start');
    }
    await sampleUntil(child.pid, Date.now() + 15_000, findings, () => findings.length > 0);
  } finally {
    child.kill();
    server.close();
  }
  return { seen: findings.some((finding) => finding.detail.includes(address)), findings };
}
