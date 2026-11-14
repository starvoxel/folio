// ------------------------------
// system-clock.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { Clock } from './clock.js';
import { localDate } from './local-date.js';

/**
 * The clock of the machine the app runs on. This is the one file in the domain allowed to use
 * `Date` (AD-7): it reads the local calendar date and the current instant, and nothing else does.
 * @returns A clock that reads the system time on every call.
 */
export function systemClock(): Clock {
  return {
    today: () => {
      const now = new Date();
      const year = String(now.getFullYear()).padStart(4, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return localDate(`${year}-${month}-${day}`);
    },
    nowEpochMs: () => Date.now(),
  };
}
