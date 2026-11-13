// ------------------------------
// boundaries.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { createRequire } from 'node:module';
import { join } from 'node:path';

import { cruise, type ICruiseOptions, type IConfiguration } from 'dependency-cruiser';
import { describe, expect, it } from 'vitest';

import { repositoryRoot } from './support/repository.js';

const require = createRequire(import.meta.url);
const config = require('../../.dependency-cruiser.cjs') as IConfiguration;
const fixtures = 'tests/architecture/fixtures';

/** One broken rule: which rule, in which file, and on which import when it is an import. */
interface Violation {
  readonly rule: string;
  readonly file: string;
  readonly imports?: string;
}

/**
 * Run the real rule set over directories in one pass, ignoring the exclude that hides the
 * fixtures from the ordinary run.
 * @param directories - The repository-relative directories to cruise together.
 * @returns Every violated rule with where it was found.
 */
async function violationsIn(directories: readonly string[]): Promise<Violation[]> {
  // The configuration hides the fixtures from the ordinary run; this test wants to see them.
  const { exclude: _hiddenFixtures, ...configuredOptions } = config.options ?? {};
  const options: ICruiseOptions = {
    ...configuredOptions,
    validate: true,
    ruleSet: { forbidden: config.forbidden ?? [] },
    tsConfig: { fileName: join(repositoryRoot, 'tsconfig.json') },
  };
  const result = await cruise(
    directories.map((directory) => join(repositoryRoot, directory)),
    options,
  );
  if (typeof result.output === 'string') {
    throw new Error('Expected a result object from dependency-cruiser');
  }
  return result.output.modules.flatMap((module) => [
    ...(module.rules ?? []).map((rule) => ({ rule: rule.name, file: module.source })),
    ...module.dependencies.flatMap((dependency) =>
      (dependency.rules ?? []).map((rule) => ({
        rule: rule.name,
        file: module.source,
        imports: dependency.resolved,
      })),
    ),
  ]);
}

/**
 * Describe a violation as `rule: file`, relative to the fixtures folder.
 * @param violation - The violation.
 * @returns The short label the fixture tests compare.
 */
function label(violation: Violation): string {
  return `${violation.rule}: ${violation.file.replace(`${fixtures}/`, '')}`;
}

/**
 * Describe a violation the way the command-line tool does, so a failure reads the same.
 * @param violation - The violation.
 * @returns `rule: file → import`.
 */
function describeViolation(violation: Violation): string {
  return violation.imports === undefined
    ? `${violation.rule}: ${violation.file}`
    : `${violation.rule}: ${violation.file} → ${violation.imports}`;
}

/**
 * Cruise the fixtures and return their short labels.
 * @returns The labels of every violation found in the fixture tree.
 */
async function fixtureViolations(): Promise<string[]> {
  return (await violationsIn([fixtures])).map(label);
}

describe('packageImports', () => {
  describe('theRealWorkspace', () => {
    it('hasNoBoundaryViolations', async () => {
      const violations = await violationsIn(['packages', 'apps', 'tests/integration', 'tests/e2e']);
      expect(violations.map(describeViolation)).toEqual([]);
    });
  });

  describe('coreImportingNode', () => {
    it('failsTheArchitectureCheck', async () => {
      expect(await fixtureViolations()).toContain(
        'core-imports-nothing-from-node: packages/core/src/imports-node.ts',
      );
    });
  });

  describe('coreImportingReactOrElectron', () => {
    it('failsTheArchitectureCheck', async () => {
      const violations = await fixtureViolations();
      expect(violations).toContain(
        'core-imports-no-ui-or-host: packages/core/src/imports-react.ts',
      );
      expect(violations).toContain(
        'core-imports-no-ui-or-host: packages/core/src/imports-electron.ts',
      );
    });
  });

  describe('coreImportingAnApp', () => {
    it('failsTheArchitectureCheck', async () => {
      const violations = await fixtureViolations();
      expect(violations).toContain('packages-do-not-import-apps: packages/core/src/imports-app.ts');
    });
  });

  describe('rendererImportingNodeOrElectron', () => {
    it('failsTheArchitectureCheck', async () => {
      const violations = await fixtureViolations();
      expect(violations).toContain(
        'renderer-imports-nothing-from-node: packages/renderer/src/imports-node.ts',
      );
      expect(violations).toContain(
        'renderer-imports-no-electron-or-node: packages/renderer/src/imports-electron.ts',
      );
    });
  });

  describe('mainProcessImportingReact', () => {
    it('failsTheArchitectureCheck', async () => {
      expect(await fixtureViolations()).toContain(
        'main-process-imports-no-react: apps/desktop/src/imports-react.ts',
      );
    });
  });

  describe('fluentOutsideUiFluent', () => {
    it('failsTheArchitectureCheckOnlyOutsideTheFolder', async () => {
      const violations = await fixtureViolations();
      expect(violations).toContain(
        'fluent-only-under-ui-fluent: packages/renderer/src/screens/imports-fluent.ts',
      );
      expect(violations.filter((violation) => violation.startsWith('fluent-only'))).not.toContain(
        'fluent-only-under-ui-fluent: packages/renderer/src/ui/fluent/allowed-fluent.ts',
      );
    });
  });

  describe('unitTestImportingElectronOrPlaywright', () => {
    it('failsTheArchitectureCheck', async () => {
      const violations = await fixtureViolations();
      expect(violations).toContain(
        'unit-tests-import-no-electron-or-driver: packages/core/src/imports-playwright.test.ts',
      );
      expect(violations).toContain(
        'unit-tests-import-no-electron-or-driver: packages/core/src/imports-electron-in-unit.test.ts',
      );
    });
  });

  describe('productionCodeImportingATestFile', () => {
    it('failsTheArchitectureCheck', async () => {
      expect(await fixtureViolations()).toContain(
        'no-production-import-of-tests: packages/host-api/src/imports-test-file.ts',
      );
    });
  });
});
