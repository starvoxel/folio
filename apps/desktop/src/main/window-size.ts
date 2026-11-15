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

/** The size the design boards use for the app window, and the smallest first-open size where the screen can hold it. */
export const PREFERRED_WINDOW_SIZE: Size = { width: 1440, height: 900 };

/** On a screen larger than the design size, the window opens at this share of the usable area. */
const LARGE_SCREEN_SHARE = 0.8;

/** The smallest window the layout supports. */
export const MINIMUM_WINDOW_SIZE: Size = { width: 900, height: 600 };

/**
 * Choose the first window size. It is only where the window starts, never a limit: the person can
 * resize or maximise it freely. The design size on a small screen (shrunk to fit), and most of the
 * screen on a large one, never below the minimum the layout supports.
 * @param workArea - The usable area of the display, without taskbars and docks.
 * @returns The window size.
 */
export function chooseWindowSize(workArea: Size): Size {
  return {
    width: Math.max(
      MINIMUM_WINDOW_SIZE.width,
      Math.min(
        Math.max(PREFERRED_WINDOW_SIZE.width, workArea.width * LARGE_SCREEN_SHARE),
        workArea.width,
      ),
    ),
    height: Math.max(
      MINIMUM_WINDOW_SIZE.height,
      Math.min(
        Math.max(PREFERRED_WINDOW_SIZE.height, workArea.height * LARGE_SCREEN_SHARE),
        workArea.height,
      ),
    ),
  };
}
