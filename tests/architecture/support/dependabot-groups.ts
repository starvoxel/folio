// ------------------------------
// dependabot-groups.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import semver from 'semver';

/** One Dependabot group as it matters here. */
export interface DependabotGroup {
  readonly name: string;
  /** Absent for the catch-all groups that select by update type, such as `patches`. */
  readonly patterns?: readonly string[];
  readonly excludePatterns?: readonly string[];
}

/** One lockfile entry, reduced to the part the check reads. */
export interface LockedDependencies {
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

/** Two direct dependencies that must be updated together, and why. */
export interface CoupledPair {
  readonly first: string;
  readonly second: string;
  readonly reason: string;
}

/**
 * Pairs that must share a group although no tight range says so. A tight range is one that admits a
 * single major version; these are bounded another way.
 */
export const DECLARED_COUPLES: readonly { first: string; second: string; reason: string }[] = [
  {
    first: 'typescript',
    second: 'typescript-eslint',
    reason: 'typescript-eslint declares the TypeScript range it supports (an upper bound, <6.1.0)',
  },
  {
    first: '@electron/packager',
    second: '@electron/asar',
    reason:
      'the packager builds the archive with its own asar major and the package-contents test reads it with ours',
  },
  {
    first: '@electron/packager',
    second: '@electron/fuses',
    reason: 'the fuse tool must know the fuse list of the Electron release the packager downloads',
  },
  {
    first: 'electron',
    second: '@electron/fuses',
    reason: 'new Electron releases add fuses that the fuse tool must know before they are flipped',
  },
];

/**
 * Match a package name against a Dependabot pattern, where `*` stands for any run of characters.
 * @param pattern - The pattern, such as `@electron/*`.
 * @param name - The package name.
 * @returns True when the whole name matches.
 */
export function matchesPattern(pattern: string, name: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`, 'u').test(name);
}

/**
 * Find the named group a package belongs to: the first group, in file order, whose patterns match
 * it and whose exclusions do not.
 * @param groups - The groups in the order the file lists them.
 * @param name - The package name.
 * @returns The group name, or null when the package falls to the catch-all groups or none.
 */
export function groupOf(groups: readonly DependabotGroup[], name: string): string | null {
  for (const group of groups) {
    if (group.patterns === undefined) {
      continue;
    }
    const included = group.patterns.some((pattern) => matchesPattern(pattern, name));
    const excluded = (group.excludePatterns ?? []).some((pattern) => matchesPattern(pattern, name));
    if (included && !excluded) {
      return group.name;
    }
  }
  return null;
}

/**
 * Tell whether a version range admits only one major version, such as `^19.3.1`. A package whose
 * partner range is this narrow cannot move to a new major on its own.
 * @param range - The semver range from a dependency map.
 * @returns True for a range that stays inside one major.
 */
export function isSingleMajor(range: string): boolean {
  try {
    const minimum = semver.minVersion(range);
    if (minimum === null) {
      return false;
    }
    return semver.subset(range, `>=${minimum.version} <${String(minimum.major + 1)}.0.0`);
  } catch {
    return false;
  }
}

/**
 * List the pairs of direct dependencies that must move together: those where one declares a
 * single-major peer range on the other, the `@types/x` packages and the package they describe, and
 * the declared couples.
 * @param direct - The names of the direct dependencies.
 * @param locked - The lockfile entries by package name, for the direct dependencies.
 * @returns The pairs, each with the reason.
 */
export function findCoupledPairs(
  direct: ReadonlySet<string>,
  locked: Readonly<Record<string, LockedDependencies | undefined>>,
): CoupledPair[] {
  const pairs: CoupledPair[] = [];
  for (const first of direct) {
    const entry = locked[first];
    // Only peer ranges force a lockstep: the package expects the host project's copy. A plain
    // dependency range is satisfied by a nested copy, so it does not tie two direct dependencies.
    for (const [second, range] of Object.entries(entry?.peerDependencies ?? {})) {
      if (direct.has(second) && isSingleMajor(range)) {
        pairs.push({ first, second, reason: `${first} peers on ${second} ${range}` });
      }
    }
    if (first.startsWith('@types/') && direct.has(first.slice('@types/'.length))) {
      pairs.push({
        first,
        second: first.slice('@types/'.length),
        reason: `${first} describes ${first.slice('@types/'.length)}`,
      });
    }
  }
  for (const couple of DECLARED_COUPLES) {
    if (direct.has(couple.first) && direct.has(couple.second)) {
      pairs.push(couple);
    }
  }
  return pairs;
}

/**
 * Check the groups against the dependency tree.
 * @param groups - The version-update groups in file order.
 * @param direct - The names of the direct dependencies.
 * @param locked - The lockfile entries by package name.
 * @param installed - The names of every installed package, to spot patterns that match nothing.
 * @returns One message per problem; empty when the groups are sound.
 */
export function findGroupProblems(
  groups: readonly DependabotGroup[],
  direct: ReadonlySet<string>,
  locked: Readonly<Record<string, LockedDependencies | undefined>>,
  installed: ReadonlySet<string>,
): string[] {
  const problems: string[] = [];
  for (const pair of findCoupledPairs(direct, locked)) {
    const left = groupOf(groups, pair.first);
    const right = groupOf(groups, pair.second);
    if (left === null || left !== right) {
      problems.push(
        `${pair.first} (${left ?? 'no named group'}) and ${pair.second} (${right ?? 'no named group'}) ` +
          `must share a named group: ${pair.reason}`,
      );
    }
  }
  for (const group of groups) {
    for (const pattern of group.patterns ?? []) {
      if (![...installed].some((name) => matchesPattern(pattern, name))) {
        problems.push(`group ${group.name}: pattern ${pattern} matches no installed package`);
      }
    }
  }
  return problems;
}
