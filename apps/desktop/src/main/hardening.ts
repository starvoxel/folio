// ------------------------------
// hardening.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { app, session, type Session, type WebContents } from 'electron';

import { isAllowedRequest, isAppUrl, describeUrlForLog } from './app-origin.js';
import type { Logger } from './logger.js';

/** Environment variables that would switch on Google services in Chromium if they were set. */
const GOOGLE_VARIABLES = [
  'GOOGLE_API_KEY',
  'GOOGLE_DEFAULT_CLIENT_ID',
  'GOOGLE_DEFAULT_CLIENT_SECRET',
];

/**
 * The process-level hardening that must happen before the app is ready (AD-18). There is no
 * crash reporter, no auto-updater and no update check anywhere in the app: nothing here starts
 * them, and nothing may.
 */
export function hardenBeforeReady(): void {
  // No proxy of any kind; this also stops proxy auto-detection.
  app.commandLine.appendSwitch('no-proxy-server');
  for (const name of GOOGLE_VARIABLES) {
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- clearing named variables
    delete process.env[name];
  }
}

/**
 * Harden a session: deny every request except the app's own, and every permission (AD-18).
 * @param target - The session to harden.
 * @param logger - Where refused requests are noted, without their paths.
 */
export function hardenSession(target: Session, logger: Logger): void {
  target.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    const allowed = isAllowedRequest(details.url);
    if (!allowed) {
      logger.warn('blocked request', {
        method: details.method,
        target: describeUrlForLog(details.url),
      });
    }
    callback({ cancel: !allowed });
  });
  target.setPermissionRequestHandler((_contents, _permission, callback) => {
    callback(false);
  });
  target.setPermissionCheckHandler(() => false);
  target.setDevicePermissionHandler(() => false);
  // Spellcheck fetches its dictionary from a Google server, and that request escapes the filter
  // above because the browser process makes it. Only an empty language list stops it (AD-18).
  target.setSpellCheckerEnabled(false);
  target.setSpellCheckerLanguages([]);
}

/**
 * Harden a window's contents: no navigation away from the app, no new windows, no webviews.
 * Links to the outside will open only from an explicit user action when a feature needs one.
 * @param contents - The contents to harden.
 */
export function hardenWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
    }
  });
  contents.on('will-redirect', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
}

/**
 * The hardening that needs the app to be ready: the default session, every web contents that is
 * created later, and certificate errors, which are never accepted.
 * @param logger - Where refused requests are noted.
 */
export function installHardening(logger: Logger): void {
  app.on('web-contents-created', (_event, contents) => {
    hardenWebContents(contents);
  });
  app.on('certificate-error', (event, _contents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  });
  hardenSession(session.defaultSession, logger);
}
