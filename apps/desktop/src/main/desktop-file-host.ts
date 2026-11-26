// ------------------------------
// desktop-file-host.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { createHash, randomUUID } from 'node:crypto';
import { hostname } from 'node:os';
import { join } from 'node:path';

import { createFileHost, type FileHost } from './file-host.js';
import type { Logger } from './logger.js';
import { nodeFsOps } from './node-fs-ops.js';
import type { PathGrants } from './path-grants.js';

/**
 * Tell whether a process is running on this computer. Signal 0 only checks; `EPERM` means the
 * process exists but belongs to someone else.
 * @param pid - The process id.
 * @returns True when it is running.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as { code?: unknown }).code === 'EPERM';
  }
}

/**
 * Compose the file host from the real file system, clock and process (AD-12): backups go to a
 * `backups` folder inside the app-data folder, never beside the budget file.
 * @param userData - The app-data folder.
 * @param grants - The paths the person has chosen.
 * @param logger - Where outcomes are noted.
 * @returns The file host.
 */
export function createDesktopFileHost(
  userData: string,
  grants: PathGrants,
  logger: Logger,
): FileHost {
  return createFileHost({
    fs: nodeFsOps,
    grants,
    logger,
    backupRoot: join(userData, 'backups'),
    self: { instance: randomUUID(), host: hostname(), pid: process.pid, takenMs: 0 },
    nowMs: () => Date.now(),
    isProcessAlive,
    uniqueId: () => randomUUID().slice(0, 8),
    hashOf: (text) => createHash('sha256').update(text).digest('hex').slice(0, 16),
  });
}
