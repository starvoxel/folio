// ------------------------------
// privacy-capture.e2e.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { appendFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { distinctFindings, type Finding } from '../../tools/privacy-capture/src/findings.js';
import { renderReport, SAMPLER_LIMITS } from '../../tools/privacy-capture/src/report.js';
import { findPackagedApp } from './support/app-path.js';
import { launchApp } from './support/launch-app.js';
import {
  captureLogPaths,
  concludeLinuxCapture,
  runControlProcess,
  startPacketRecorder,
  straceWrapper,
} from './support/linux-capture.js';
import { PAGES } from './support/pages.js';
import { runSamplerControl, sampleUntil } from './support/socket-sampler.js';

/** The idle phase of the scenario. The plan asks for five minutes; a developer may shorten it. */
const IDLE_SECONDS = Number(process.env['FOLIO_CAPTURE_IDLE_SECONDS'] ?? '300');

/** What one platform's capture concluded. */
interface Outcome {
  readonly title: string;
  readonly controlSeen: boolean;
  readonly findings: readonly Finding[];
  readonly limits: readonly string[];
}

/**
 * Visit every page, then sit idle, the way a household member's app would.
 * @param page - The app page.
 */
async function useTheApp(page: Page): Promise<void> {
  for (const [id, pageTitle] of PAGES) {
    await page.getByTestId(`nav-${id}`).click();
    await page.evaluate(() => window.__folio?.settled());
    await expect(page.getByRole('heading', { level: 1, name: pageTitle })).toBeVisible();
  }
  await new Promise((resolve) => setTimeout(resolve, IDLE_SECONDS * 1_000));
}

/**
 * Linux: the app runs under strace while tcpdump records the namespace's only interface.
 * @param userDataDirectory - A fresh app-data folder.
 * @param outputDirectory - Where the raw logs are kept.
 * @returns The conclusion.
 */
async function captureOnLinux(
  userDataDirectory: string,
  outputDirectory: string,
): Promise<Outcome> {
  const logs = captureLogPaths(outputDirectory);
  const recorder = await startPacketRecorder();
  const controlFindings = await runControlProcess(logs.control);
  const app = await launchApp(findPackagedApp(), {
    userDataDirectory,
    wrapper: straceWrapper(logs.app),
  });
  await useTheApp(app.page);
  await app.shutDown();
  const packets = await recorder.stop();
  await writeFile(logs.packets, packets);
  const result = concludeLinuxCapture(controlFindings, await readFile(logs.app, 'utf8'), packets);
  return {
    title: 'Linux network namespace capture (strace and tcpdump)',
    ...result,
    limits: [],
  };
}

/**
 * Windows and macOS: the operating system's socket tables are sampled for the app's process tree.
 * @param userDataDirectory - A fresh app-data folder.
 * @returns The conclusion.
 */
async function captureBySampling(userDataDirectory: string): Promise<Outcome> {
  const control = await runSamplerControl();
  const app = await launchApp(findPackagedApp(), { userDataDirectory });
  if (app.pid === undefined) {
    throw new Error('The app has no process id to sample');
  }
  const seen: Finding[] = [];
  let finished = false;
  const sampling = sampleUntil(app.pid, Number.POSITIVE_INFINITY, seen, () => finished);
  try {
    await useTheApp(app.page);
  } finally {
    finished = true;
    await sampling;
    await app.shutDown();
  }
  return {
    title: `${process.platform === 'win32' ? 'Windows' : 'macOS'} per-process socket sampling`,
    controlSeen: control.seen,
    findings: seen,
    limits: SAMPLER_LIMITS,
  };
}

test.describe('privacyCapture', () => {
  test.describe('packagedApp', () => {
    test('makesNoOutboundAttemptThroughLaunchEveryPageAndIdle', async () => {
      const testInfo = test.info();
      test.skip(
        !['linux', 'win32', 'darwin'].includes(process.platform),
        'No capture for this platform',
      );
      await mkdir(testInfo.outputDir, { recursive: true });
      const userDataDirectory = await mkdtemp(join(tmpdir(), 'folio-capture-'));
      let outcome: Outcome;
      try {
        outcome =
          process.platform === 'linux'
            ? await captureOnLinux(userDataDirectory, testInfo.outputDir)
            : await captureBySampling(userDataDirectory);
      } finally {
        await rm(userDataDirectory, { recursive: true, force: true });
      }

      const report = renderReport(outcome);
      await writeFile(join(testInfo.outputDir, 'report.md'), report);
      const summary = process.env['GITHUB_STEP_SUMMARY'];
      if (summary !== undefined) {
        await appendFile(summary, `${report}\n`);
      }
      expect(outcome.controlSeen, report).toBe(true);
      expect(
        distinctFindings(outcome.findings)
          .filter((finding) => !finding.allowed)
          .map((finding) => finding.detail),
        report,
      ).toEqual([]);
    });
  });
});
