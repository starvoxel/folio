// ------------------------------
// mount-app.tsx
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { systemClock, type Clock } from '@folio/core';
import type { HostApi } from '@folio/host-api';

import { App } from './app.js';
import { AppServicesProvider } from './app-services.js';
import { createAppStore } from './app-state.js';
import { installAutomation } from './automation.js';
import { readCspNonce } from './csp-nonce.js';

/** Options of `mountApp`. */
export interface MountOptions {
  /** The clock; the system clock when omitted. Tests pass a fixed one. */
  readonly clock?: Clock;
}

/** A mounted app. */
export interface MountedApp {
  /** Remove the app from the page. */
  unmount(): void;
}

/**
 * Draw the app into a container, using a host for everything the operating system provides.
 * The desktop entry passes the preload bridge, tests and the browser build pass a mock.
 * @param host - The host.
 * @param container - Where to draw.
 * @param options - The clock.
 * @returns A handle to remove the app.
 */
export async function mountApp(
  host: HostApi,
  container: HTMLElement,
  options: MountOptions = {},
): Promise<MountedApp> {
  const info = await host.getInfo();
  const store = createAppStore(options.clock ?? systemClock());
  if (info.automation) {
    installAutomation(window, store);
  }
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <AppServicesProvider
        services={{ host, store, cspNonce: readCspNonce(container.ownerDocument) }}
      >
        <App />
      </AppServicesProvider>
    </StrictMode>,
  );
  return {
    unmount: () => {
      root.unmount();
    },
  };
}
