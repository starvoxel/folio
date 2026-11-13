// ------------------------------
// host-api.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * A file the host knows about. `path` is meaningful only to the host that made it: a file-system
 * path on the desktop, a handle name in a browser. Callers pass it back and never parse it.
 */
export interface FileRef {
  readonly path: string;
  readonly name: string;
}

/** What identifies the state of a file on disk, for the on-disk change check (AD-12). */
export interface FileStamp {
  readonly modifiedMs: number;
  readonly sizeBytes: number;
}

/** A named group of file extensions for a file dialog, without the dot. */
export interface FileFilter {
  readonly name: string;
  readonly extensions: readonly string[];
}

/** Options for the native open dialog. */
export interface OpenDialogOptions {
  readonly title?: string;
  readonly filters?: readonly FileFilter[];
}

/** Options for the native save dialog. */
export interface SaveDialogOptions {
  readonly title?: string;
  readonly suggestedName?: string;
  readonly filters?: readonly FileFilter[];
}

/** The bytes of a file together with the stamp they were read at. */
export interface FileContents {
  readonly bytes: Uint8Array;
  readonly stamp: FileStamp;
}

/** The outcome of an atomic write. */
export type WriteResult =
  | { readonly kind: 'saved'; readonly stamp: FileStamp }
  | { readonly kind: 'changedOnDisk'; readonly current: FileStamp };

/** The outcome of asking for the sidecar lock of a file (AD-12). */
export type LockResult =
  | { readonly kind: 'acquired' }
  | { readonly kind: 'held'; readonly holder: string; readonly stale: boolean };

/** Commands the native or hamburger menu can send to the renderer (H1.14, H1.16). */
export type MenuCommand =
  | 'new'
  | 'open'
  | 'save'
  | 'saveAs'
  | 'closeFile'
  | 'undo'
  | 'redo'
  | 'importCsv'
  | 'settings'
  | 'about';

/** Facts about the host the renderer may need. */
export interface HostInfo {
  readonly platform: 'win32' | 'darwin' | 'linux' | 'web';
  /** True only when the app was started with FOLIO_AUTOMATION=1 (AD-16). */
  readonly automation: boolean;
  readonly appVersion: string;
}

/** Stops listening when called. */
export type Unsubscribe = () => void;

/** Why a host call failed. */
export type HostErrorCode = 'notFound' | 'permissionDenied' | 'unavailable' | 'invalid';

/** A failed host call. The message never contains file contents or amounts. */
export class HostError extends Error {
  readonly code: HostErrorCode;

  /**
   * Create a host error.
   * @param code - What went wrong, for callers that branch on it.
   * @param message - A description that carries no financial data.
   */
  constructor(code: HostErrorCode, message: string) {
    super(message);
    this.name = 'HostError';
    this.code = code;
  }
}

/**
 * The one door from the renderer to the operating system (AD-19). Electron implements it with a
 * preload bridge, tests use the in-memory mock, and a browser build can implement a read-only
 * subset. Everything the renderer needs from the machine goes through this interface.
 */
export interface HostApi {
  /** Report the platform, app version and whether automation is on. */
  getInfo(): Promise<HostInfo>;
  /** Ask the user for a file to open; null when they cancel. */
  showOpenDialog(options?: OpenDialogOptions): Promise<FileRef | null>;
  /** Ask the user where to save; null when they cancel. */
  showSaveDialog(options?: SaveDialogOptions): Promise<FileRef | null>;
  /** Read a whole file. Rejects with a `HostError` when it is missing or unreadable. */
  readFile(file: FileRef): Promise<FileContents>;
  /**
   * Replace a file atomically: write a temporary file, flush, rename over the target (AD-12).
   * When `expected` is given and the file on disk no longer matches it, nothing is written.
   */
  writeFileAtomic(
    file: FileRef,
    bytes: Uint8Array,
    expected: FileStamp | null,
  ): Promise<WriteResult>;
  /** Take the sidecar lock of a file, or report who holds it and whether the lock is stale. */
  acquireLock(file: FileRef): Promise<LockResult>;
  /** Release a lock this host holds. */
  releaseLock(file: FileRef): Promise<void>;
  /** Copy bytes into the app-data backup folder and return where they went (AD-12). */
  backUp(file: FileRef, bytes: Uint8Array): Promise<FileRef>;
  /** Read the machine settings (AD-11) as untrusted JSON; null when none are stored yet. */
  readSettings(): Promise<unknown>;
  /** Replace the machine settings. */
  writeSettings(settings: unknown): Promise<void>;
  /** Listen for menu commands; returns a function that stops listening. */
  onMenuCommand(listener: (command: MenuCommand) => void): Unsubscribe;
  /** Listen for files dropped on the window; returns a function that stops listening. */
  onFilesDropped(listener: (files: readonly FileRef[]) => void): Unsubscribe;
  /** Show a file in the system file manager. */
  revealInFolder(file: FileRef): Promise<void>;
  /** Quit the application. */
  quit(): Promise<void>;
}
