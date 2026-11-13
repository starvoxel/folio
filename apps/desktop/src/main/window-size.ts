// ------------------------------
// window-size.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** A width and a height in device-independent pixels. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The size the design boards use for the app window. */
export const PREFERRED_WINDOW_SIZE: Size = { width: 1440, height: 900 };

/** The smallest window the layout supports. */
export const MINIMUM_WINDOW_SIZE: Size = { width: 900, height: 600 };

/**
 * Choose the first window size: the design size, shrunk to fit a small screen, never below the
 * minimum the layout supports.
 * @param workArea - The usable area of the display, without taskbars and docks.
 * @returns The window size.
 */
export function chooseWindowSize(workArea: Size): Size {
  return {
    width: Math.max(
      MINIMUM_WINDOW_SIZE.width,
      Math.min(PREFERRED_WINDOW_SIZE.width, workArea.width),
    ),
    height: Math.max(
      MINIMUM_WINDOW_SIZE.height,
      Math.min(PREFERRED_WINDOW_SIZE.height, workArea.height),
    ),
  };
}
