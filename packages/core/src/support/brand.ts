// ------------------------------
// brand.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * A compile-time label attached to an ordinary value (AD-7). At runtime a branded value is just
 * the base value; the compiler treats it as a different type from the base and from every other
 * brand, so a bare number cannot be passed where `Money` is expected.
 */
export type Brand<Base, Tag extends string> = Base & { readonly __brand: Tag };
