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

const STAMP = String.raw`\d{8}T\d{9}Z`;

/**
 * @param epochMs - A moment, in milliseconds since the Unix epoch.
 * @returns It as `YYYYMMDDTHHMMSSmmmZ` in UTC, which sorts in time order as text.
 */
export function backupStamp(epochMs: number): string {
  return new Date(epochMs).toISOString().replace(/[-:.]/gu, '');
}

/**
 * @param fileName - The budget file's name, such as `Household 2026.folio`.
 * @param epochMs - When the backup is made.
 * @returns The backup's name: the file's name with the time before the extension.
 */
export function backupFileName(fileName: string, epochMs: number): string {
  const extension = extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length);
  return `${stem}-${backupStamp(epochMs)}${extension}`;
}

/**
 * Pick the backups to delete so only the newest few stay. Only names this module made for this
 * file count, so anything else in the folder is left alone.
 * @param names - Everything in the backup folder.
 * @param fileName - The budget file's name.
 * @param keep - How many to keep.
 * @returns The names to delete, oldest first.
 */
export function backupsToDelete(
  names: readonly string[],
  fileName: string,
  keep: number = BACKUPS_KEPT,
): string[] {
  const extension = extname(fileName);
  const stem = fileName.slice(0, fileName.length - extension.length);
  const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
  const pattern = new RegExp(`^${escape(stem)}-${STAMP}${escape(extension)}$`, 'u');
  const ours = names.filter((name) => pattern.test(name)).sort();
  return ours.slice(0, Math.max(0, ours.length - keep));
}
