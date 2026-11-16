// ------------------------------
// main.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { mountApp } from './app/mount-app.js';

/**
 * The entry point of the shipped renderer. The host bridge comes from the preload script; without
 * it the page cannot do anything useful, so it says so instead of starting half-working.
 */
async function start(): Promise<void> {
  const container = document.getElementById('root');
  if (container === null) {
    throw new Error('The page has no #root element to draw the app into');
  }
  const host = window.folioHost;
  if (host === undefined) {
    container.textContent = 'Folio cannot start: the host bridge is missing.';
    return;
  }
  await mountApp(host, container);
}

void start();
