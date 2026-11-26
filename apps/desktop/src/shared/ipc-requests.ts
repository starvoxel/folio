// ------------------------------
// ipc-requests.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type {
  FileFilter,
  FileRef,
  FileStamp,
  LockOptions,
  OpenDialogOptions,
  SaveDialogOptions,
} from '@folio/host-api';

/** The largest file the host will read, write or back up. A household's budget is a few MB (AD-1). */
export const MAX_FILE_BYTES = 256 * 1024 * 1024;

const MAX_PATH_LENGTH = 4096;
const MAX_NAME_LENGTH = 255;

type Unknown = Record<string, unknown>;

const isRecord = (value: unknown): value is Unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Check a file reference from the page. Only its shape is checked here; whether the person chose
 * the path is the main process's separate check.
 * @param value - Untrusted input.
 * @returns The reference, or null when it is malformed.
 */
export function parseFileRef(value: unknown): FileRef | null {
  if (!isRecord(value)) {
    return null;
  }
  const { path, name } = value;
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    path.length > MAX_PATH_LENGTH ||
    path.includes('\0') ||
    typeof name !== 'string' ||
    name.length > MAX_NAME_LENGTH
  ) {
    return null;
  }
  return { path, name };
}

/**
 * Check a file stamp from the page.
 * @param value - Untrusted input.
 * @returns The stamp, or null when it is malformed.
 */
export function parseStamp(value: unknown): FileStamp | null {
  if (!isRecord(value)) {
    return null;
  }
  const { modifiedMs, sizeBytes } = value;
  return Number.isFinite(modifiedMs) &&
    Number.isSafeInteger(sizeBytes) &&
    (sizeBytes as number) >= 0
    ? { modifiedMs: modifiedMs as number, sizeBytes: sizeBytes as number }
    : null;
}

/**
 * Check file contents from the page. Electron delivers a typed array across the bridge.
 * @param value - Untrusted input.
 * @returns The bytes, or null when they are not bytes or are too many.
 */
function parseBytes(value: unknown): Uint8Array | null {
  return value instanceof Uint8Array && value.byteLength <= MAX_FILE_BYTES ? value : null;
}

/** A checked request to replace a file. */
export interface WriteRequest {
  readonly file: FileRef;
  readonly bytes: Uint8Array;
  readonly expected: FileStamp | null;
}

/**
 * Check a request to replace a file.
 * @param value - Untrusted input: `{ file, bytes, expected }`.
 * @returns The request, or null when any part is malformed.
 */
export function parseWriteRequest(value: unknown): WriteRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const file = parseFileRef(value['file']);
  const bytes = parseBytes(value['bytes']);
  const expected = value['expected'] === null ? null : parseStamp(value['expected']);
  return file === null || bytes === null || (expected === null && value['expected'] !== null)
    ? null
    : { file, bytes, expected };
}

/** A checked request to take a lock. */
export interface LockRequest {
  readonly file: FileRef;
  readonly options: LockOptions;
}

/**
 * Check a request to take a lock.
 * @param value - Untrusted input: `{ file, options? }`.
 * @returns The request, or null when malformed.
 */
export function parseLockRequest(value: unknown): LockRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const file = parseFileRef(value['file']);
  const options = value['options'];
  if (file === null) {
    return null;
  }
  if (options === undefined || options === null) {
    return { file, options: {} };
  }
  if (
    !isRecord(options) ||
    (options['takeOverStale'] !== undefined && typeof options['takeOverStale'] !== 'boolean')
  ) {
    return null;
  }
  return { file, options: options['takeOverStale'] === true ? { takeOverStale: true } : {} };
}

/** A checked request to back up bytes. */
export interface BackUpRequest {
  readonly file: FileRef;
  readonly bytes: Uint8Array;
}

/**
 * Check a request to back up a file's bytes.
 * @param value - Untrusted input: `{ file, bytes }`.
 * @returns The request, or null when malformed.
 */
export function parseBackUpRequest(value: unknown): BackUpRequest | null {
  if (!isRecord(value)) {
    return null;
  }
  const file = parseFileRef(value['file']);
  const bytes = parseBytes(value['bytes']);
  return file === null || bytes === null ? null : { file, bytes };
}

/**
 * Check dialog filters.
 * @param value - Untrusted input, or undefined.
 * @returns The filters (empty when none were given), or null when malformed.
 */
function parseFilters(value: unknown): readonly FileFilter[] | null {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 10) {
    return null;
  }
  const filters: FileFilter[] = [];
  for (const entry of value as unknown[]) {
    if (!isRecord(entry) || typeof entry['name'] !== 'string' || entry['name'].length > 100) {
      return null;
    }
    const extensions = entry['extensions'];
    if (
      !Array.isArray(extensions) ||
      extensions.length > 20 ||
      !(extensions as unknown[]).every(
        (extension) => typeof extension === 'string' && /^[A-Za-z0-9]{1,16}$/u.test(extension),
      )
    ) {
      return null;
    }
    filters.push({ name: entry['name'], extensions: extensions as string[] });
  }
  return filters;
}

/**
 * Check the options of a native dialog. A missing argument means no options.
 * @param value - Untrusted input.
 * @param withSuggestedName - Whether a suggested file name is accepted (the save dialog).
 * @returns Clean options, or null when malformed. A suggested name loses any folder part.
 */
export function parseDialogOptions(
  value: unknown,
  withSuggestedName: boolean,
): (OpenDialogOptions & SaveDialogOptions) | null {
  if (value === undefined || value === null) {
    return {};
  }
  if (!isRecord(value)) {
    return null;
  }
  const { title, suggestedName } = value;
  const filters = parseFilters(value['filters']);
  if (
    filters === null ||
    (title !== undefined && (typeof title !== 'string' || title.length > 200)) ||
    (suggestedName !== undefined && (!withSuggestedName || typeof suggestedName !== 'string'))
  ) {
    return null;
  }
  const justTheName =
    typeof suggestedName === 'string' ? (suggestedName.split(/[\\/]/u).at(-1) ?? '') : '';
  return {
    ...(typeof title === 'string' ? { title } : {}),
    ...(justTheName.length > 0 && justTheName.length <= MAX_NAME_LENGTH
      ? { suggestedName: justTheName }
      : {}),
    ...(filters.length > 0 ? { filters } : {}),
  };
}

/**
 * Check the labels that name a menu item, for the automation command.
 * @param value - Untrusted input: an array of one to four labels.
 * @returns The labels, or null when malformed.
 */
export function parseMenuPath(value: unknown): readonly string[] | null {
  return Array.isArray(value) &&
    value.length >= 1 &&
    value.length <= 4 &&
    (value as unknown[]).every((label) => typeof label === 'string' && label.length <= 100)
    ? (value as string[])
    : null;
}
