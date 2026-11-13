// ------------------------------
// licences.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** Licences that count as "MIT or equivalent" (02_constraints.md): permissive, no copyleft. */
export const ALLOWED_LICENCES: ReadonlySet<string> = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'Unlicense',
]);

/** One entry of licence-exceptions.json. */
export interface LicenceException {
  readonly packages: readonly string[];
  readonly license: string;
  readonly reason: string;
  readonly decision: string;
}

/** The part of a lockfile entry the check reads. */
export interface LockedPackage {
  readonly license?: string;
  readonly link?: boolean;
}

/**
 * Decide whether an SPDX expression is acceptable: `A OR B` needs one acceptable side, `A AND B`
 * needs both, and brackets group.
 * @param expression - The licence expression from the lockfile.
 * @returns True when every obligation of at least one alternative is an allowed licence.
 */
export function isAllowedExpression(expression: string): boolean {
  const tokens = expression.match(/\(|\)|[^\s()]+/gu) ?? [];
  let position = 0;
  const parseOr = (): boolean => {
    let result = parseAnd();
    while (tokens[position] === 'OR') {
      position += 1;
      const next = parseAnd();
      result = result || next;
    }
    return result;
  };
  const parseAnd = (): boolean => {
    let result = parseAtom();
    while (tokens[position] === 'AND') {
      position += 1;
      const next = parseAtom();
      result = result && next;
    }
    return result;
  };
  const parseAtom = (): boolean => {
    const token = tokens[position];
    position += 1;
    if (token === '(') {
      const inner = parseOr();
      position += 1;
      return inner;
    }
    return token !== undefined && ALLOWED_LICENCES.has(token);
  };
  return tokens.length > 0 && parseOr();
}

/**
 * Check every installed package of a lockfile against the allowed licences and the recorded
 * exceptions. Workspace packages of this repository are not dependencies and are skipped.
 * @param packages - The `packages` object of package-lock.json.
 * @param exceptions - The entries of licence-exceptions.json.
 * @returns One message per problem; empty when the tree complies.
 */
export function findLicenceProblems(
  packages: Readonly<Record<string, LockedPackage>>,
  exceptions: readonly LicenceException[],
): string[] {
  const problems: string[] = [];
  const used = new Set<string>();
  for (const [path, entry] of Object.entries(packages)) {
    if (!path.includes('node_modules/') || entry.link === true) {
      continue;
    }
    const name = path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length);
    const licence = entry.license;
    if (licence !== undefined && isAllowedExpression(licence)) {
      continue;
    }
    const exception = exceptions.find(
      (candidate) => candidate.packages.includes(name) && candidate.license === licence,
    );
    if (exception === undefined) {
      problems.push(
        `${name}: ${licence ?? 'no licence declared'} is not allowed and has no recorded decision`,
      );
    } else {
      used.add(`${name}\0${exception.license}`);
    }
  }
  for (const exception of exceptions) {
    for (const name of exception.packages) {
      if (!used.has(`${name}\0${exception.license}`)) {
        problems.push(
          `${name}: the exception for ${exception.license} matches nothing in the lockfile`,
        );
      }
    }
  }
  return problems;
}
