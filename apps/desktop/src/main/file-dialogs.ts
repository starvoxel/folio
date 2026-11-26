// ------------------------------
// file-dialogs.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { basename } from 'node:path';

import { BrowserWindow, dialog, type WebContents } from 'electron';

import type { FileRef, OpenDialogOptions, SaveDialogOptions } from '@folio/host-api';

import type { PathGrants } from './path-grants.js';

/** The native open and save dialogs. Whatever they return becomes a path the page may use. */
export interface FileDialogs {
  open(sender: WebContents, options: OpenDialogOptions): Promise<FileRef | null>;
  save(sender: WebContents, options: SaveDialogOptions): Promise<FileRef | null>;
}

/**
 * @param path - A path the person chose.
 * @returns The reference the page receives.
 */
function refFor(path: string): FileRef {
  return { path, name: basename(path) };
}

/**
 * Create the dialogs. Each path they return is granted, which is the only way the page gets
 * permission to read or write a file (see `PathGrants`).
 * @param grants - Where chosen paths are recorded.
 * @param automationAnswer - A path that answers every dialog without showing one, set only when
 *   automation is on (AD-16), so end-to-end tests can reach the file operations. Null otherwise.
 * @returns The dialogs.
 */
export function createFileDialogs(
  grants: PathGrants,
  automationAnswer: string | null,
): FileDialogs {
  const answer = (chosen: string | undefined): FileRef | null => {
    if (chosen === undefined) {
      return null;
    }
    grants.grant(chosen);
    return refFor(chosen);
  };
  const filtersOf = (
    options: OpenDialogOptions,
  ): { filters?: { name: string; extensions: string[] }[] } =>
    options.filters === undefined
      ? {}
      : {
          filters: options.filters.map((filter) => ({
            name: filter.name,
            extensions: [...filter.extensions],
          })),
        };
  return {
    open: async (sender, options) => {
      if (automationAnswer !== null) {
        return answer(automationAnswer);
      }
      const request = {
        ...(options.title === undefined ? {} : { title: options.title }),
        ...filtersOf(options),
        properties: ['openFile' as const],
      };
      const window = BrowserWindow.fromWebContents(sender);
      const result =
        window === null
          ? await dialog.showOpenDialog(request)
          : await dialog.showOpenDialog(window, request);
      return result.canceled ? null : answer(result.filePaths[0]);
    },
    save: async (sender, options) => {
      if (automationAnswer !== null) {
        return answer(automationAnswer);
      }
      const request = {
        ...(options.title === undefined ? {} : { title: options.title }),
        ...(options.suggestedName === undefined ? {} : { defaultPath: options.suggestedName }),
        ...filtersOf(options),
      };
      const window = BrowserWindow.fromWebContents(sender);
      const result =
        window === null
          ? await dialog.showSaveDialog(request)
          : await dialog.showSaveDialog(window, request);
      return result.canceled ? null : answer(result.filePath);
    },
  };
}
