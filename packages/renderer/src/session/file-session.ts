// ------------------------------
// file-session.ts
//
// Author: Starvoxel AI Agent - 2026-11-28
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  createBudget,
  decodeFolio,
  encodeFolio,
  err,
  ok,
  type BudgetModel,
  type CarriedParts,
  type Clock,
  type DamagedLine,
  type DecodeFailure,
  type Digest,
  type Result,
} from '@folio/core';
import {
  hostErrorCode,
  type FileEvent,
  type FileRef,
  type FileStamp,
  type FileStore,
  type OpenFailureReason,
} from '@folio/host-api';

/** What a session needs from the outside. */
export interface FileSessionDeps {
  readonly store: FileStore;
  readonly digest: Digest;
  readonly clock: Clock;
  readonly appVersion: string;
  /** Ask the person where to save a new file; null when they cancel. */
  readonly chooseSaveLocation: (suggestedName: string) => Promise<FileRef | null>;
  /** Tell the log what happened, as a closed event. It never throws. */
  readonly report: (event: FileEvent) => void;
}

/** A file that is open: its model, where it lives and what was dropped on the way in. */
export interface OpenedFile {
  readonly model: BudgetModel;
  readonly file: FileRef;
  /** JSONL lines that could not be read and were left out (AD-2). */
  readonly damagedLines: readonly DamagedLine[];
  /** True when the model came from a backup, so saving will replace a damaged file. */
  readonly fromBackup: boolean;
}

/** Why a file could not be opened. */
export type OpenFailure =
  | { readonly kind: 'locked'; readonly holder: string; readonly stale: boolean }
  | { readonly kind: 'notFound' }
  | { readonly kind: 'unreadable' }
  | {
      readonly kind: 'invalidFile';
      readonly failure: DecodeFailure;
      /** The newest backup, when the damage is the kind a backup can repair. */
      readonly backup: FileRef | null;
    };

/** Why a file could not be created. */
export type CreateFailure =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'locked'; readonly holder: string; readonly stale: boolean }
  | { readonly kind: 'writeFailed' };

/** Why a save did not happen. Nothing is written in any of these cases. */
export type SaveFailure =
  | { readonly kind: 'noFile' }
  | { readonly kind: 'changedOnDisk' }
  | { readonly kind: 'fileGone' }
  | { readonly kind: 'failed' };

/** Options of `open`. */
export interface OpenOptions {
  /** Replace a stale lock, after the person was told (AD-12). */
  readonly takeOverStale?: boolean;
}

/**
 * The one open file and everything done to it (AD-19): create, open, save and close, through the
 * file store, the codec and the lock. Screens never see bytes or stamps.
 */
export interface FileSession {
  /** The file that is open now, or null. */
  readonly current: FileRef | null;
  /** Ask where to save, then write a new empty budget there, locked and backed up. */
  create(name: string): Promise<Result<OpenedFile, CreateFailure>>;
  /** Lock, read, check and open a file; the old file is let go only when the new one opened. */
  open(file: FileRef, options?: OpenOptions): Promise<Result<OpenedFile, OpenFailure>>;
  /** Open the backup of a damaged file, so that saving replaces the damaged one (H1.11). */
  openBackup(original: FileRef, backup: FileRef): Promise<Result<OpenedFile, OpenFailure>>;
  /** Save the model to the open file, refusing when it changed on disk since it was read. */
  save(model: BudgetModel): Promise<Result<null, SaveFailure>>;
  /** Release the lock and forget the file. */
  close(): Promise<void>;
}

interface Open {
  readonly file: FileRef;
  readonly stamp: FileStamp;
  readonly carried: CarriedParts;
}

const DAMAGE_A_BACKUP_CANNOT_REPAIR: ReadonlySet<DecodeFailure['code']> = new Set(['newerFormat']);

/**
 * Make a file name to suggest from a budget's name.
 * @param name - The budget's name.
 * @returns The name with characters that file systems refuse replaced, plus the extension.
 */
function suggestedFileName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]/gu, '-').trim();
  return `${cleaned === '' ? 'Budget' : cleaned}.folio`;
}

/**
 * Turn what a host call rejected with into the reason the session reports.
 * @param error - Whatever was thrown.
 * @returns A missing file, or an unreadable one for every other cause.
 */
function readFailureKind(error: unknown): 'notFound' | 'unreadable' {
  return hostErrorCode(error) === 'notFound' ? 'notFound' : 'unreadable';
}

/**
 * Make a file session.
 * @param deps - The store, the digest, the clock and the log.
 * @returns The session, with no file open.
 */
export function createFileSession(deps: FileSessionDeps): FileSession {
  const { store, digest, report } = deps;
  let open: Open | null = null;

  const release = async (file: FileRef): Promise<void> => {
    try {
      await store.unlock(file);
    } catch {
      // A lock that cannot be released goes stale by itself; there is nothing to show the person.
    }
  };

  const closeCurrent = async (): Promise<void> => {
    const previous = open;
    open = null;
    if (previous !== null) {
      await release(previous.file);
    }
  };

  const backUpQuietly = async (file: FileRef, bytes: Uint8Array): Promise<void> => {
    try {
      await store.backUp(file, bytes);
    } catch {
      // A failed backup must not stop the person from working; the next open tries again.
    }
  };

  const failOpen = (
    reason: OpenFailureReason,
    failure: OpenFailure,
  ): Result<never, OpenFailure> => {
    report({ kind: 'openFailed', reason });
    return err(failure);
  };

  const decodeInto = async (
    file: FileRef,
    contents: Uint8Array,
    stamp: FileStamp,
    fromBackup: boolean,
  ): Promise<Result<OpenedFile, OpenFailure>> => {
    const decoded = await decodeFolio(contents, { digest });
    if (!decoded.ok) {
      const backup = DAMAGE_A_BACKUP_CANNOT_REPAIR.has(decoded.error.code)
        ? null
        : await store.latestBackup(file).catch(() => null);
      await release(file);
      return failOpen(decoded.error.code, {
        kind: 'invalidFile',
        failure: decoded.error,
        backup,
      });
    }
    const { model, carried, damagedLines } = decoded.value;
    if (!fromBackup) {
      await backUpQuietly(file, contents);
    }
    open = { file, stamp, carried };
    report({ kind: 'opened', damagedLines: damagedLines.length, fromBackup });
    return ok({ model, file, damagedLines, fromBackup });
  };

  const lockFile = async (
    file: FileRef,
    takeOverStale: boolean,
  ): Promise<Result<null, { holder: string; stale: boolean } | 'failed'>> => {
    try {
      const lock = await store.lock(file, { takeOverStale });
      return lock.kind === 'acquired' ? ok(null) : err({ holder: lock.holder, stale: lock.stale });
    } catch {
      return err('failed');
    }
  };

  return {
    get current() {
      return open?.file ?? null;
    },

    create: async (name) => {
      const location = await deps.chooseSaveLocation(suggestedFileName(name));
      if (location === null) {
        return err({ kind: 'cancelled' });
      }
      const locked = await lockFile(location, false);
      if (!locked.ok) {
        return err(
          locked.error === 'failed' ? { kind: 'writeFailed' } : { kind: 'locked', ...locked.error },
        );
      }
      try {
        const model = createBudget(name, deps.clock);
        const bytes = await encodeFolio(model, { digest, appVersion: deps.appVersion });
        const saved = await store.save(location, bytes, null);
        if (saved.kind !== 'saved') {
          throw new Error('Unexpected save result');
        }
        await backUpQuietly(location, bytes);
        await closeCurrent();
        open = { file: location, stamp: saved.stamp, carried: {} };
        report({ kind: 'created' });
        return ok({ model, file: location, damagedLines: [], fromBackup: false });
      } catch {
        await release(location);
        return err({ kind: 'writeFailed' });
      }
    },

    open: async (file, options) => {
      if (open?.file.path === file.path) {
        await closeCurrent();
      }
      const locked = await lockFile(file, options?.takeOverStale === true);
      if (!locked.ok) {
        return locked.error === 'failed'
          ? failOpen('unreadable', { kind: 'unreadable' })
          : failOpen('locked', { kind: 'locked', ...locked.error });
      }
      const previous = open;
      try {
        const { bytes, stamp } = await store.open(file);
        const result = await decodeInto(file, bytes, stamp, false);
        if (result.ok && previous !== null) {
          await release(previous.file);
        }
        return result;
      } catch (error) {
        await release(file);
        const kind = readFailureKind(error);
        return failOpen(kind, { kind });
      }
    },

    openBackup: async (original, backup) => {
      await closeCurrent();
      const locked = await lockFile(original, false);
      if (!locked.ok) {
        return locked.error === 'failed'
          ? failOpen('unreadable', { kind: 'unreadable' })
          : failOpen('locked', { kind: 'locked', ...locked.error });
      }
      try {
        const [copy, current] = await Promise.all([store.open(backup), store.open(original)]);
        return await decodeInto(original, copy.bytes, current.stamp, true);
      } catch (error) {
        await release(original);
        const kind = readFailureKind(error);
        return failOpen(kind, { kind });
      }
    },

    save: async (model) => {
      if (open === null) {
        return err({ kind: 'noFile' });
      }
      const { file, stamp, carried } = open;
      try {
        const bytes = await encodeFolio(model, { digest, appVersion: deps.appVersion, carried });
        const saved = await store.save(file, bytes, stamp);
        if (saved.kind === 'changedOnDisk') {
          return err({ kind: 'changedOnDisk' });
        }
        open = { file, stamp: saved.stamp, carried };
        return ok(null);
      } catch (error) {
        return err({ kind: hostErrorCode(error) === 'notFound' ? 'fileGone' : 'failed' });
      }
    },

    close: closeCurrent,
  };
}
