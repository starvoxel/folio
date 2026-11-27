// ------------------------------
// failures.ts
//
// Author: Starvoxel AI Agent - 2026-11-27
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import type { ValidationIssue } from '../support/schema.js';

/**
 * Why a file could not be opened. Every case names a part or a version at most, never a value
 * (AD-10), so a failure can be logged and shown as it is.
 */
export type DecodeFailure =
  | { readonly code: 'notAZip' }
  | { readonly code: 'manifestMissing' }
  | { readonly code: 'manifestInvalid' }
  | { readonly code: 'newerFormat'; readonly formatVersion: number }
  | { readonly code: 'partMissing'; readonly part: string }
  | { readonly code: 'checksumMismatch'; readonly part: string }
  | {
      readonly code: 'schemaInvalid';
      readonly part: string;
      readonly issues: readonly ValidationIssue[];
    }
  | { readonly code: 'migrationFailed'; readonly fromVersion: number };

/** A JSONL line that was dropped because it did not parse or did not fit its schema. */
export interface DamagedLine {
  readonly part: string;
  /** Counted from 1. */
  readonly line: number;
}
