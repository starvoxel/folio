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

/**
 * Run the real rule set over a directory, ignoring the exclude that hides the fixtures from the
 * ordinary run.
 * @param directory - The repository-relative directory to cruise.
 * @returns The violated rule names, each with the file it was found in.
 */
async function violationsIn(directory: string): Promise<string[]> {
  const options: ICruiseOptions = {
    ...config.options,
    exclude: { path: 'node_modules' },
    validate: true,
    ruleSet: { forbidden: config.forbidden ?? [] },
    tsConfig: { fileName: join(repositoryRoot, 'tsconfig.json') },
  };
  const result = await cruise([join(repositoryRoot, directory)], options);
  if (typeof result.output === 'string') {
    throw new Error('Expected a result object from dependency-cruiser');
  }
  return result.output.modules.flatMap((module) => {
    const where = module.source.replace(`${fixtures}/`, '');
    return [
      ...(module.rules ?? []).map((rule) => `${rule.name}: ${where}`),
      ...module.dependencies.flatMap((dependency) =>
        (dependency.rules ?? []).map((rule) => `${rule.name}: ${where}`),
      ),
    ];
  });
}

describe('packageImports', () => {
  describe('theRealWorkspace', () => {
    it('hasNoBoundaryViolations', async () => {
      const violations = [
        ...(await violationsIn('packages')),
        ...(await violationsIn('apps')),
        ...(await violationsIn('tests/integration')),
        ...(await violationsIn('tests/e2e')),
      ];
      expect(violations).toEqual([]);
    });
  });

  describe('coreImportingNode', () => {
    it('failsTheArchitectureCheck', async () => {
      expect(await violationsIn(fixtures)).toContain(
        'core-imports-nothing-from-node: packages/core/src/imports-node.ts',
      );
    });
  });

  describe('coreImportingReactOrElectron', () => {
    it('failsTheArchitectureCheck', async () => {
      const violations = await violationsIn(fixtures);
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
      const violations = await violationsIn(fixtures);
      expect(violations).toContain('packages-do-not-import-apps: packages/core/src/imports-app.ts');
    });
  });

  describe('rendererImportingNodeOrElectron', () => {
    it('failsTheArchitectureCheck', async () => {
      const violations = await violationsIn(fixtures);
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
      expect(await violationsIn(fixtures)).toContain(
        'main-process-imports-no-react: apps/desktop/src/imports-react.ts',
      );
    });
  });

  describe('fluentOutsideUiFluent', () => {
    it('failsTheArchitectureCheckOnlyOutsideTheFolder', async () => {
      const violations = await violationsIn(fixtures);
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
      const violations = await violationsIn(fixtures);
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
      expect(await violationsIn(fixtures)).toContain(
        'no-production-import-of-tests: packages/host-api/src/imports-test-file.ts',
      );
    });
  });
});
