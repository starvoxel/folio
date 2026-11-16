// ------------------------------
// guard.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { spawn } from 'node:child_process';

import { expect, test } from '@playwright/test';

import { findPackagedApp, platformLaunchArguments } from './support/app-path.js';

/**
 * Start the packaged app with a switch and without FOLIO_AUTOMATION, and report how it ended.
 * @param switchName - The command-line switch to pass.
 * @returns The exit code and what the app wrote to standard error.
 */
async function startWithSwitch(
  switchName: string,
): Promise<{ code: number | null; stderr: string }> {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  delete environment['FOLIO_AUTOMATION'];
  const child = spawn(findPackagedApp().executable, [switchName, ...platformLaunchArguments()], {
    stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'],
    env: environment,
  });
  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });
  const code = await new Promise<number | null>((resolve) => {
    const timer = setTimeout(() => {
      child.kill();
      resolve(-1);
    }, 30_000);
    child.once('exit', (exitCode) => {
      clearTimeout(timer);
      resolve(exitCode);
    });
  });
  return { code, stderr };
}

test.describe('packagedApp', () => {
  test.describe('debuggingSwitchWithoutAutomation', () => {
    for (const switchName of [
      '--remote-debugging-pipe',
      '--remote-debugging-port=0',
      '--remote-allow-origins=*',
      '--inspect=0',
    ]) {
      test(`refuses${switchName.replace(/[^a-z]/giu, '')}`, async () => {
        const { code, stderr } = await startWithSwitch(switchName);
        expect(code, stderr).toBe(2);
        expect(stderr).toContain('FOLIO_AUTOMATION');
      });
    }
  });
});
