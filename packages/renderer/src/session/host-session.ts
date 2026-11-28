// ------------------------------
// host-session.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { systemClock, type Clock } from '@folio/core';
import { createHostFileStore, type HostApi } from '@folio/host-api';

import { createFileSession, type FileSession } from './file-session.js';
import { webDigest } from './web-digest.js';

/**
 * Make the file session for a host: its file store, the save dialog and the log.
 * @param host - The host the renderer runs on.
 * @param clock - The clock; the system clock unless a test passes its own.
 * @returns A session with no file open.
 */
export async function createHostSession(
  host: HostApi,
  clock: Clock = systemClock(),
): Promise<FileSession> {
  const info = await host.getInfo();
  return createFileSession({
    store: createHostFileStore(host),
    digest: webDigest,
    clock,
    appVersion: info.appVersion,
    chooseSaveLocation: (suggestedName) =>
      host.showSaveDialog({
        title: 'Create a budget file',
        suggestedName,
        filters: [{ name: 'Folio budget', extensions: ['folio'] }],
      }),
    report: (event) => {
      host.logFileEvent(event).catch(() => undefined);
    },
  });
}
