// ------------------------------
// main.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

// The entry the integration build uses instead of the shipped one (packages/renderer/src/main.tsx).
// It calls the same mountApp, with an in-memory host and a fixed clock, so the real renderer code
// runs in a real browser engine with nothing else around it.
import { fixedClock, localDate } from '@folio/core';
import { createMockHost } from '@folio/host-api';
import { mountApp } from '@folio/renderer';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('The test page has no #root element');
}
await mountApp(createMockHost({ info: { automation: true, platform: 'linux' } }), container, {
  clock: fixedClock(localDate('2026-11-13')),
});
