// ------------------------------
// file-drops.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The part of a drag event the preload reads; the preload has no DOM types of its own. */
export interface DropEventLike {
  /** False for an event a script made up. */
  readonly isTrusted: boolean;
  readonly dataTransfer: {
    readonly types: readonly string[];
    readonly files: ArrayLike<unknown>;
  } | null;
  preventDefault(): void;
}

/** The part of `window` that `watchFileDrops` listens on. */
export interface DropTarget {
  addEventListener(
    type: 'dragover' | 'drop',
    listener: (event: DropEventLike) => void,
    capture: boolean,
  ): void;
}

/**
 * Report files dropped on the window with their real paths, which the page cannot read. Only a
 * drop the user made counts: a script's synthetic drop is not trusted, and its files have no path.
 * Drags inside the page carry no files, so they are left alone and in-page drag and drop is
 * unaffected. The page still receives the drop event itself.
 * @param target - The window.
 * @param pathOf - Turns a dropped file into its path, or an empty string when it has none.
 * @param report - Receives the paths of one drop.
 */
export function watchFileDrops(
  target: DropTarget,
  pathOf: (file: unknown) => string,
  report: (paths: string[]) => void,
): void {
  const carriesFiles = (event: DropEventLike): boolean =>
    event.dataTransfer?.types.includes('Files') === true;
  target.addEventListener(
    'dragover',
    (event) => {
      if (carriesFiles(event)) {
        // Without this the browser refuses the drop and then navigates to the file.
        event.preventDefault();
      }
    },
    true,
  );
  target.addEventListener(
    'drop',
    (event) => {
      if (!carriesFiles(event)) {
        return;
      }
      event.preventDefault();
      if (!event.isTrusted) {
        return;
      }
      const paths = Array.from(event.dataTransfer?.files ?? [], pathOf).filter(
        (path) => path !== '',
      );
      if (paths.length > 0) {
        report(paths);
      }
    },
    true,
  );
}
