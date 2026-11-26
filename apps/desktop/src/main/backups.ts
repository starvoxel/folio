// ------------------------------
// backups.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { extname } from 'node:path';

/** How many backups of one file are kept. Backup frequency and retention settings come later (H). */
export const BACKUPS_KEPT = 10;

const STAMP = String.raw`\d{8}-\d{6}`;

/**
 * @param epochMs - A moment, in milliseconds since the Unix epoch.
 * @returns It as `YYYYMMDD-HHMMSS` in UTC, to the whole second.
 */
export function backupStamp(epochMs: number): string {
  const iso = new Date(epochMs).toISOString();
  return `${iso.slice(0, 10).replaceAll('-', '')}-${iso.slice(11, 19).replaceAll(':', '')}`;
}

/**
 * @param text - Literal text.
 * @returns It escaped for use inside a regular expression.
 */
function escapeForPattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
}

/**
 * @param fileName - A budget file's name.
 * @returns The name without its extension, and the extension.
 */
function splitName(fileName: string): { stem: string; extension: string } {
  const extension = extname(fileName);
  return { stem: fileName.slice(0, fileName.length - extension.length), extension };
}

/**
 * Name a backup: the file's name, `_`, the UTC time to the second, then the extension. Two backups
 * in one second would collide, so the next one gets `_2`, then `_3` and so on before the extension.
 * @param fileName - The budget file's name, such as `Household 2026.folio`.
 * @param epochMs - When the backup is made.
 * @param taken - The names already in the backup folder.
 * @returns A name that sorts after every backup already made in that second, such as `Household 2026_20261126-024500.folio`.
 */
export function backupFileName(
  fileName: string,
  epochMs: number,
  taken: readonly string[] = [],
): string {
  const { stem, extension } = splitName(fileName);
  const base = `${stem}_${backupStamp(epochMs)}`;
  // Number above the highest counter in use, not the first free one: after the oldest backup is
  // pruned its name is free again, and reusing it would make the newest backup sort as the oldest.
  const used = new RegExp(
    `^${escapeForPattern(base)}(?:_(\\d+))?${escapeForPattern(extension)}$`,
    'u',
  );
  let highest = 0;
  for (const name of taken) {
    const match = used.exec(name);
    if (match !== null) {
      highest = Math.max(highest, Number(match[1] ?? 1));
    }
  }
  return highest === 0 ? `${base}${extension}` : `${base}_${String(highest + 1)}${extension}`;
}

/**
 * Pick the backups to delete so only the newest few stay. Only names this module made for this
 * file count, so anything else in the folder is left alone. Backups are ordered by time and then
 * by counter, as numbers, because `_10` would sort before `_2` as text.
 * @param names - Everything in the backup folder.
 * @param fileName - The budget file's name.
 * @param keep - How many to keep.
 * @param protectedName - A backup that is never deleted, such as the one just written, which a
 *   clock that moved backwards would otherwise rank as the oldest.
 * @returns The names to delete, oldest first.
 */
export function backupsToDelete(
  names: readonly string[],
  fileName: string,
  keep: number = BACKUPS_KEPT,
  protectedName?: string,
): string[] {
  const { stem, extension } = splitName(fileName);
  const pattern = new RegExp(
    `^${escapeForPattern(stem)}_(${STAMP})(?:_(\\d+))?${escapeForPattern(extension)}$`,
    'u',
  );
  const ours = names
    .flatMap((name) => {
      const match = pattern.exec(name);
      return match === null
        ? []
        : [{ name, stamp: match[1] ?? '', counter: Number(match[2] ?? 1) }];
    })
    .sort((left, right) =>
      left.stamp === right.stamp ? left.counter - right.counter : left.stamp < right.stamp ? -1 : 1,
    );
  const excess = Math.max(0, ours.length - keep);
  return ours
    .filter((entry) => entry.name !== protectedName)
    .slice(0, excess)
    .map((entry) => entry.name);
}
