// ------------------------------
// menu-automation.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The part of an Electron menu item that the automation commands read. */
export interface MenuItemLike {
  readonly label: string;
  readonly accelerator?: string | null | undefined;
  readonly submenu?: { readonly items: readonly MenuItemLike[] } | null | undefined;
  readonly click: () => void;
}

/** A menu as plain data, for a test to read. */
export interface MenuNode {
  readonly label: string;
  readonly accelerator?: string;
  readonly children?: readonly MenuNode[];
}

/**
 * Find a menu item by the labels on the way to it, such as `['File', 'Save']`.
 * @param items - The top-level items.
 * @param path - The labels to follow.
 * @returns The item, or null when there is none or it is a separator.
 */
export function findMenuItem(
  items: readonly MenuItemLike[],
  path: readonly string[],
): MenuItemLike | null {
  const [first, ...rest] = path;
  const found = items.find((item) => item.label === first);
  if (found === undefined) {
    return null;
  }
  return rest.length === 0 ? found : findMenuItem(found.submenu?.items ?? [], rest);
}

/**
 * Turn a menu into plain data. Separators, which have no label, are left out.
 * @param items - The items.
 * @returns The labelled items with their shortcuts and children.
 */
export function describeMenu(items: readonly MenuItemLike[]): MenuNode[] {
  return items
    .filter((item) => item.label !== '')
    .map((item) => {
      const children = describeMenu(item.submenu?.items ?? []);
      return {
        label: item.label,
        ...(typeof item.accelerator === 'string' ? { accelerator: item.accelerator } : {}),
        ...(children.length > 0 ? { children } : {}),
      };
    });
}
