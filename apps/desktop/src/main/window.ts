// ------------------------------
// window.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { join } from 'node:path';

import { app, BrowserWindow, screen } from 'electron';

import { APP_ORIGIN } from './app-origin.js';
import { MINIMUM_WINDOW_SIZE, chooseWindowSize } from './window-size.js';

/**
 * Open the app window with the renderer locked down (AD-18): context isolation on, Node
 * integration off, the Chromium sandbox on, no webview, spellcheck off, and only the preload
 * bridge between the page and the system.
 * @returns The window.
 */
export function createMainWindow(): BrowserWindow {
  const size = chooseWindowSize(screen.getPrimaryDisplay().workAreaSize);
  const window = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: MINIMUM_WINDOW_SIZE.width,
    minHeight: MINIMUM_WINDOW_SIZE.height,
    title: 'Folio',
    show: true,
    webPreferences: {
      preload: join(app.getAppPath(), 'dist', 'preload', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
    },
  });
  window.removeMenu();
  void window.loadURL(APP_ORIGIN);
  return window;
}
