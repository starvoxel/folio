// ------------------------------
// codec.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { z } from 'zod';

import type { BudgetModel } from '../budget/model.js';
import { yearMonthOf } from '../domain/local-date.js';
import { err, ok, type Result } from '../support/result.js';
import { parseWithSchema, type ValidationIssue } from '../support/schema.js';
import type { Digest } from './digest.js';
import type { DamagedLine, DecodeFailure } from './failures.js';
import { FORMAT_VERSION, manifestSchema, type Manifest } from './manifest.js';
import { checkModel } from './model-checks.js';
import { MIGRATIONS, runMigrations, type MigrationStep } from './migrations.js';
import {
  accountsPartSchema,
  carriedJsonSchema,
  carriedLineSchema,
  categoriesPartSchema,
  settingsPartSchema,
} from './part-schemas.js';
import { PART_REGISTRY, type PartSpec } from './parts.js';
import { stableStringify } from './stable-json.js';
import { entryText, unzipEntries, zipEntries, type ZipEntry } from './zip-bytes.js';
import { strToU8 } from 'fflate';

const MANIFEST_FILE = 'manifest.json';
const SUMMARY_FILE = 'summary.json';

/** Content of parts whose owning plan has not landed, by part name, carried through unread. */
export type CarriedParts = Readonly<Record<string, readonly unknown[]>>;

/** What `encodeFolio` needs. */
export interface EncodeOptions {
  readonly digest: Digest;
  readonly appVersion?: string;
  readonly carried?: CarriedParts;
}

/** What `decodeFolio` needs. */
export interface DecodeOptions {
  readonly digest: Digest;
  /** The chain of upgrades; the real one unless a test passes its own. */
  readonly migrations?: readonly MigrationStep[];
}

/** A file that opened: the model, what was carried, and any lines that were dropped. */
export interface DecodeOutcome {
  readonly model: BudgetModel;
  readonly carried: CarriedParts;
  readonly damagedLines: readonly DamagedLine[];
}

/**
 * Write the text of one part.
 * @param spec - The part.
 * @param value - Its content: a JSON value, or the list of records for a JSONL part.
 * @returns The text.
 */
function partText(spec: PartSpec, value: unknown): string {
  if (spec.kind === 'json') {
    return `${stableStringify(value, 2)}\n`;
  }
  const records = Array.isArray(value) ? value : [];
  return records.map((record) => `${stableStringify(record, 0)}\n`).join('');
}

/**
 * What the start screen shows without loading the rest (H1.1). The open month is the month the
 * file was created in until months exist; the last closed month stays empty until close exists.
 * @param model - The model.
 * @returns The summary.
 */
function summaryOf(model: BudgetModel): unknown {
  return {
    name: model.settings.name,
    openMonth: yearMonthOf(model.settings.createdOn),
    accountCount: model.accounts.length,
    lastClosedMonth: null,
  };
}

/**
 * Turn a model into the bytes of a `.folio` file. The same input always gives the same bytes.
 * @param model - The model.
 * @param options - The digest, the app version and the carried parts.
 * @returns The file's bytes.
 * @throws {RangeError} When a carried part does not fit the schema its part expects, which is a bug.
 */
export async function encodeFolio(model: BudgetModel, options: EncodeOptions): Promise<Uint8Array> {
  const content: Record<string, unknown> = {
    settings: model.settings,
    accounts: model.accounts,
    categories: model.categories,
  };
  const entries: ZipEntry[] = [];
  const parts: Manifest['parts'] = [];
  const add = async (
    name: string,
    kind: 'json' | 'jsonl',
    file: string,
    text: string,
  ): Promise<void> => {
    entries.push({ name: file, text });
    parts.push({ name, file, kind, sha256: await options.digest(strToU8(text)) });
  };
  await add('summary', 'json', SUMMARY_FILE, `${stableStringify(summaryOf(model), 2)}\n`);
  for (const spec of PART_REGISTRY) {
    const value = spec.carried ? (options.carried?.[spec.name] ?? spec.empty) : content[spec.name];
    if (spec.carried && !isValidCarried(spec, value)) {
      throw new RangeError(`Carried part ${spec.name} does not fit its schema`);
    }
    await add(spec.name, spec.kind, spec.fileName, partText(spec, value));
  }
  const manifest: Manifest = {
    format: 'folio',
    formatVersion: FORMAT_VERSION,
    ...(options.appVersion === undefined ? {} : { appVersion: options.appVersion }),
    parts,
  };
  return zipEntries([
    { name: MANIFEST_FILE, text: `${stableStringify(manifest, 2)}\n` },
    ...entries,
  ]);
}

/**
 * @param spec - A carried part.
 * @param value - Content offered for it.
 * @returns True when every record (or the whole list) fits.
 */
function isValidCarried(spec: PartSpec, value: unknown): boolean {
  if (spec.kind === 'json') {
    return parseWithSchema(spec.schema, value).ok;
  }
  return Array.isArray(value) && value.every((line) => parseWithSchema(spec.schema, line).ok);
}

/** A parsed JSONL line, kept with its number so a damaged one can be reported. */
interface Line {
  readonly line: number;
  readonly value: unknown;
  readonly readable: boolean;
}

/**
 * @param text - The text of a JSONL part.
 * @returns Its non-blank lines, each parsed or marked unreadable.
 */
function readLines(text: string): Line[] {
  const lines: Line[] = [];
  text.split('\n').forEach((raw, index) => {
    if (raw.trim() === '') {
      return;
    }
    try {
      lines.push({ line: index + 1, value: JSON.parse(raw) as unknown, readable: true });
    } catch {
      lines.push({ line: index + 1, value: null, readable: false });
    }
  });
  return lines;
}

/** Reads only the version, so a newer format is refused even if the rest of its manifest differs. */
const versionPeekSchema = z.object({ formatVersion: z.number().int() });

const NOT_JSON: ValidationIssue = { path: '', message: 'Not valid JSON' };

/**
 * Read and validate the manifest, refusing a newer format before anything else about it.
 * @param entries - The unzipped entries.
 * @returns The manifest, or why it cannot be used.
 */
function readManifest(entries: Map<string, Uint8Array>): Result<Manifest, DecodeFailure> {
  const bytes = entries.get(MANIFEST_FILE);
  if (bytes === undefined) {
    return err({ code: 'manifestMissing' });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(entryText(bytes));
  } catch {
    return err({ code: 'manifestInvalid' });
  }
  const peeked = parseWithSchema(versionPeekSchema, parsed);
  if (peeked.ok && peeked.value.formatVersion > FORMAT_VERSION) {
    return err({ code: 'newerFormat', formatVersion: peeked.value.formatVersion });
  }
  const checked = parseWithSchema(manifestSchema, parsed);
  return checked.ok ? ok(checked.value) : err({ code: 'manifestInvalid' });
}

/**
 * Check that every part the registry knows (and the summary) is present and matches its checksum.
 * @param manifest - The manifest.
 * @param entries - The unzipped entries.
 * @param digest - The digest.
 * @returns The text of each part by name, or the first part that is missing or damaged.
 */
async function readParts(
  manifest: Manifest,
  entries: Map<string, Uint8Array>,
  digest: Digest,
): Promise<Result<Map<string, string>, DecodeFailure>> {
  const texts = new Map<string, string>();
  const wanted = [{ name: 'summary', fileName: SUMMARY_FILE }, ...PART_REGISTRY];
  for (const spec of wanted) {
    const listed = manifest.parts.find((part) => part.name === spec.name);
    const bytes = listed === undefined ? undefined : entries.get(listed.file);
    if (listed === undefined || bytes === undefined) {
      return err({ code: 'partMissing', part: spec.name });
    }
    if ((await digest(bytes)) !== listed.sha256) {
      return err({ code: 'checksumMismatch', part: spec.name });
    }
    texts.set(spec.name, entryText(bytes));
  }
  return ok(texts);
}

/**
 * Open a `.folio` file from its bytes. The input is untrusted: this never throws, and every
 * failure names a part and never a value.
 * @param bytes - The file's bytes.
 * @param options - The digest and, for tests, a migration chain.
 * @returns The model with what was carried and any dropped lines, or why the file cannot be opened.
 */
export async function decodeFolio(
  bytes: Uint8Array,
  options: DecodeOptions,
): Promise<Result<DecodeOutcome, DecodeFailure>> {
  const unzipped = unzipEntries(bytes);
  if (!unzipped.ok) {
    return err({ code: 'notAZip' });
  }
  const manifest = readManifest(unzipped.value);
  if (!manifest.ok) {
    return manifest;
  }
  const texts = await readParts(manifest.value, unzipped.value, options.digest);
  if (!texts.ok) {
    return texts;
  }
  const raw: Record<string, unknown> = {};
  for (const spec of PART_REGISTRY) {
    const text = texts.value.get(spec.name) ?? '';
    if (spec.kind === 'jsonl') {
      raw[spec.name] = readLines(text);
      continue;
    }
    try {
      raw[spec.name] = JSON.parse(text) as unknown;
    } catch {
      return err({ code: 'schemaInvalid', part: spec.name, issues: [NOT_JSON] });
    }
  }
  const migrated = runMigrations(
    raw,
    manifest.value.formatVersion,
    options.migrations ?? MIGRATIONS,
  );
  if (!migrated.ok) {
    return err({ code: 'migrationFailed', fromVersion: migrated.error.fromVersion });
  }
  return assemble(migrated.value);
}

/**
 * @param value - A part as read.
 * @returns True when it is the list of lines `readLines` makes.
 */
function isLines(value: unknown): value is readonly Line[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'object' && item !== null && 'line' in item)
  );
}

/**
 * Validate one part, naming it in the failure.
 * @param part - The part's name.
 * @param schema - Its schema.
 * @param value - What was read.
 * @returns The validated content, or the failure.
 */
function validatePart<S extends z.ZodType>(
  part: string,
  schema: S,
  value: unknown,
): Result<z.output<S>, DecodeFailure> {
  const checked = parseWithSchema(schema, value);
  return checked.ok ? checked : err({ code: 'schemaInvalid', part, issues: checked.error.issues });
}

/**
 * Validate the parts and build the model.
 * @param raw - The parts at the current version.
 * @returns The outcome, or the first part that does not fit its schema or breaks a rule.
 */
function assemble(raw: Record<string, unknown>): Result<DecodeOutcome, DecodeFailure> {
  const settings = validatePart('settings', settingsPartSchema, raw['settings']);
  const accounts = validatePart('accounts', accountsPartSchema, raw['accounts']);
  const categories = validatePart('categories', categoriesPartSchema, raw['categories']);
  if (!settings.ok) {
    return settings;
  }
  if (!accounts.ok) {
    return accounts;
  }
  if (!categories.ok) {
    return categories;
  }
  const model: BudgetModel = {
    settings: settings.value,
    accounts: accounts.value,
    categories: categories.value,
  };
  const broken = [...checkModel(model).entries()][0];
  if (broken !== undefined) {
    return err({ code: 'schemaInvalid', part: broken[0], issues: broken[1] });
  }
  const carried: Record<string, readonly unknown[]> = {};
  const damagedLines: DamagedLine[] = [];
  for (const spec of PART_REGISTRY.filter((part) => part.carried)) {
    const value = raw[spec.name];
    if (spec.kind === 'json') {
      const list = validatePart(spec.name, carriedJsonSchema, value);
      if (!list.ok) {
        return list;
      }
      carried[spec.name] = list.value;
      continue;
    }
    const kept: unknown[] = [];
    for (const line of isLines(value) ? value : []) {
      const checked = line.readable ? parseWithSchema(carriedLineSchema, line.value) : null;
      if (checked?.ok === true) {
        kept.push(checked.value);
      } else {
        damagedLines.push({ part: spec.name, line: line.line });
      }
    }
    carried[spec.name] = kept;
  }
  return ok({ model, carried, damagedLines });
}
