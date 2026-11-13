// ------------------------------
// mock-host.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import {
  HostError,
  type FileContents,
  type FileRef,
  type FileStamp,
  type HostApi,
  type HostInfo,
  type LockResult,
  type MenuCommand,
  type Unsubscribe,
  type WriteResult,
} from './host-api.js';

/** Settings of `createMockHost`. */
export interface MockHostOptions {
  readonly info?: Partial<HostInfo>;
  /** Files that exist from the start, by path. */
  readonly files?: Readonly<Record<string, Uint8Array>>;
  /** Machine settings that exist from the start. */
  readonly settings?: unknown;
}

/** What tests use to steer and inspect a mock host, which the real interface does not offer. */
export interface MockHostControls {
  /** Answer the next open dialog with this file, or null for cancel. */
  queueOpenDialog(result: FileRef | null): void;
  /** Answer the next save dialog with this file, or null for cancel. */
  queueSaveDialog(result: FileRef | null): void;
  /** Send a menu command to listeners. */
  emitMenuCommand(command: MenuCommand): void;
  /** Send a file drop to listeners. */
  emitFilesDropped(files: readonly FileRef[]): void;
  /** Create or replace a file from outside the app, as another program would. */
  putFile(path: string, bytes: Uint8Array): void;
  /** Read a file's bytes, or undefined when it does not exist. */
  fileBytes(path: string): Uint8Array | undefined;
  /** Mark a file as locked by another computer. */
  lockFromElsewhere(path: string, holder: string, stale: boolean): void;
  /** Backups made so far, oldest first. */
  readonly backups: readonly { readonly file: FileRef; readonly bytes: Uint8Array }[];
  /** Files shown in the file manager so far. */
  readonly revealed: readonly FileRef[];
  /** How many times the app asked to quit. */
  readonly quitCount: number;
  /** The machine settings as last written. */
  readonly settings: unknown;
  /** Paths currently locked by this host. */
  readonly heldLocks: readonly string[];
}

/** A `HostApi` that lives in memory, with the controls tests need. */
export interface MockHost extends HostApi {
  readonly controls: MockHostControls;
}

interface StoredFile {
  readonly bytes: Uint8Array;
  readonly stamp: FileStamp;
}

interface ForeignLock {
  readonly holder: string;
  readonly stale: boolean;
}

/**
 * Create an in-memory host for tests and for the renderer's integration build. File times come
 * from a counter, so every run is deterministic.
 * @param options - Starting files, settings and info.
 * @returns The mock host.
 */
export function createMockHost(options: MockHostOptions = {}): MockHost {
  const info: HostInfo = {
    platform: 'web',
    automation: false,
    appVersion: '0.0.0-mock',
    ...options.info,
  };
  const files = new Map<string, StoredFile>();
  const foreignLocks = new Map<string, ForeignLock>();
  const ownLocks = new Set<string>();
  const backups: { file: FileRef; bytes: Uint8Array }[] = [];
  const revealed: FileRef[] = [];
  const menuListeners = new Set<(command: MenuCommand) => void>();
  const dropListeners = new Set<(files: readonly FileRef[]) => void>();
  const openAnswers: (FileRef | null)[] = [];
  const saveAnswers: (FileRef | null)[] = [];
  let clock = 0;
  let quitCount = 0;
  let settings: unknown = options.settings ?? null;

  const store = (path: string, bytes: Uint8Array): FileStamp => {
    clock += 1;
    const stamp: FileStamp = { modifiedMs: clock, sizeBytes: bytes.byteLength };
    files.set(path, { bytes: bytes.slice(), stamp });
    return stamp;
  };
  for (const [path, bytes] of Object.entries(options.files ?? {})) {
    store(path, bytes);
  }

  const nameOf = (path: string): string => path.split(/[\\/]/u).at(-1) ?? path;
  const sameStamp = (left: FileStamp, right: FileStamp): boolean =>
    left.modifiedMs === right.modifiedMs && left.sizeBytes === right.sizeBytes;

  const controls: MockHostControls = {
    queueOpenDialog: (result) => void openAnswers.push(result),
    queueSaveDialog: (result) => void saveAnswers.push(result),
    emitMenuCommand: (command) => {
      for (const listener of [...menuListeners]) {
        listener(command);
      }
    },
    emitFilesDropped: (dropped) => {
      for (const listener of [...dropListeners]) {
        listener(dropped);
      }
    },
    putFile: (path, bytes) => void store(path, bytes),
    fileBytes: (path) => files.get(path)?.bytes.slice(),
    lockFromElsewhere: (path, holder, stale) => void foreignLocks.set(path, { holder, stale }),
    backups,
    revealed,
    get quitCount() {
      return quitCount;
    },
    get settings() {
      return settings;
    },
    get heldLocks() {
      return [...ownLocks];
    },
  };

  return {
    controls,
    getInfo: () => Promise.resolve(info),
    showOpenDialog: () => Promise.resolve(openAnswers.shift() ?? null),
    showSaveDialog: () => Promise.resolve(saveAnswers.shift() ?? null),
    readFile: (file): Promise<FileContents> => {
      const found = files.get(file.path);
      if (found === undefined) {
        return Promise.reject(new HostError('notFound', 'The file does not exist'));
      }
      return Promise.resolve({ bytes: found.bytes.slice(), stamp: found.stamp });
    },
    writeFileAtomic: (file, bytes, expected): Promise<WriteResult> => {
      const current = files.get(file.path);
      if (expected !== null && current !== undefined && !sameStamp(expected, current.stamp)) {
        return Promise.resolve({ kind: 'changedOnDisk', current: current.stamp });
      }
      return Promise.resolve({ kind: 'saved', stamp: store(file.path, bytes) });
    },
    acquireLock: (file): Promise<LockResult> => {
      const foreign = foreignLocks.get(file.path);
      if (foreign !== undefined) {
        return Promise.resolve({ kind: 'held', holder: foreign.holder, stale: foreign.stale });
      }
      ownLocks.add(file.path);
      return Promise.resolve({ kind: 'acquired' });
    },
    releaseLock: (file) => {
      ownLocks.delete(file.path);
      return Promise.resolve();
    },
    backUp: (file, bytes) => {
      const copy: FileRef = {
        path: `backups/${String(backups.length + 1)}-${nameOf(file.path)}`,
        name: nameOf(file.path),
      };
      backups.push({ file: copy, bytes: bytes.slice() });
      return Promise.resolve(copy);
    },
    readSettings: () => Promise.resolve(settings),
    writeSettings: (next) => {
      settings = next;
      return Promise.resolve();
    },
    onMenuCommand: (listener): Unsubscribe => {
      menuListeners.add(listener);
      return () => void menuListeners.delete(listener);
    },
    onFilesDropped: (listener): Unsubscribe => {
      dropListeners.add(listener);
      return () => void dropListeners.delete(listener);
    },
    revealInFolder: (file) => {
      revealed.push(file);
      return Promise.resolve();
    },
    quit: () => {
      quitCount += 1;
      return Promise.resolve();
    },
  };
}
