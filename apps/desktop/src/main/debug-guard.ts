// ------------------------------
// debug-guard.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The switches that hand full control of the app to another process (AD-16). */
const REFUSED_SWITCH = /^--(remote-debugging-[a-z-]+|remote-allow-origins|inspect[a-z-]*)(=|$)/u;

/**
 * Find the command-line switches the app refuses unless automation was asked for. Chromium's
 * remote debugging gives complete control of the app and no fuse turns it off, so the main
 * process checks for it itself. The environment variable is the explicit request (H1.17).
 * @param argv - The command-line arguments.
 * @param env - The environment variables.
 * @returns The refused switches, empty when none are present or automation is on.
 */
export function findRefusedSwitches(
  argv: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): string[] {
  if (env['FOLIO_AUTOMATION'] === '1') {
    return [];
  }
  return argv.filter((argument) => REFUSED_SWITCH.test(argument));
}

/**
 * Tell whether the app was started with automation on.
 * @param env - The environment variables.
 * @returns True only for FOLIO_AUTOMATION=1.
 */
export function isAutomationEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env['FOLIO_AUTOMATION'] === '1';
}

/**
 * The path that answers every file dialog without showing one, for end-to-end tests. It exists
 * only while automation is on (AD-16), so a normal run can never skip the person's choice.
 * @param env - The environment the app runs with.
 * @returns The path, or null when automation is off or none is set.
 */
export function automationDialogAnswer(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  return isAutomationEnabled(env) ? (env['FOLIO_AUTOMATION_DIALOG_PATH'] ?? null) : null;
}
