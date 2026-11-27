// ------------------------------
// zip-bytes.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';

import { err, ok, type Result } from '../support/result.js';

/** A file inside the container. */
export interface ZipEntry {
  readonly name: string;
  readonly text: string;
}

/** The most one entry may expand to; a bigger claim is refused before anything is inflated. */
export const MAX_ENTRY_BYTES = 256 * 1024 * 1024;

const FIXED_DOS_DATE = 33;
const FIXED_DOS_TIME = 0;
// fflate writes the zip time from local-time getters, which differs between machines. Any mid-year
// value keeps its year in range on every time zone; the bytes are overwritten with fixed ones below.
const PLACEHOLDER_MTIME = 646_833_600_000;
const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

/**
 * Overwrite every entry's time and date with one fixed value, so the same entries always give the
 * same bytes on every machine (AD-2).
 * @param zip - A zip made by fflate, with no archive comment.
 * @throws {Error} When the zip is not laid out as fflate writes it, which is a bug.
 */
function fixTimestamps(zip: Uint8Array): void {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const end = zip.byteLength - 22;
  if (end < 0 || view.getUint32(end, true) !== END_SIGNATURE) {
    throw new Error('Unexpected zip layout');
  }
  let offset = view.getUint32(end + 16, true);
  for (let entry = 0; entry < view.getUint16(end + 10, true); entry += 1) {
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      throw new Error('Unexpected zip layout');
    }
    const local = view.getUint32(offset + 42, true);
    for (const at of [offset + 12, local + 10]) {
      view.setUint16(at, FIXED_DOS_TIME, true);
      view.setUint16(at + 2, FIXED_DOS_DATE, true);
    }
    offset +=
      46 +
      view.getUint16(offset + 28, true) +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
}

/**
 * Zip text entries in the given order with fixed timestamps.
 * @param entries - The entries, in the order they are written.
 * @returns The zip bytes, the same for the same entries on any machine.
 */
export function zipEntries(entries: readonly ZipEntry[]): Uint8Array {
  const files: Zippable = {};
  for (const entry of entries) {
    files[entry.name] = [strToU8(entry.text), { mtime: PLACEHOLDER_MTIME }];
  }
  const zip = zipSync(files);
  fixTimestamps(zip);
  return zip;
}

/**
 * Read a zip into text entries. Untrusted input: it never throws and never inflates an entry that
 * claims to be larger than `MAX_ENTRY_BYTES`.
 * @param bytes - The file's bytes.
 * @returns The entries by name, or `notAZip` for anything that is not a readable zip.
 */
export function unzipEntries(bytes: Uint8Array): Result<Map<string, Uint8Array>, 'notAZip'> {
  try {
    const seen = { tooLarge: false };
    const files = unzipSync(bytes, {
      filter: (file) => {
        seen.tooLarge ||= file.originalSize > MAX_ENTRY_BYTES;
        return file.originalSize <= MAX_ENTRY_BYTES;
      },
    });
    return seen.tooLarge ? err('notAZip') : ok(new Map(Object.entries(files)));
  } catch {
    return err('notAZip');
  }
}

/**
 * Decode an entry's bytes as UTF-8 text.
 * @param data - The bytes.
 * @returns The text.
 */
export function entryText(data: Uint8Array): string {
  return strFromU8(data);
}
