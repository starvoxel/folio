// ------------------------------
// .dependency-cruiser.cjs
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * The package boundary rules of AD-14, as dependency-cruiser fitness functions.
 *
 * Paths are matched without a leading anchor so the architecture tests can run the same rules
 * over small fixture trees (tests/architecture/fixtures) that mirror the real layout.
 */

const CORE = '(^|/)packages/core/src/';
const HOST_API = '(^|/)packages/host-api/src/';
const RENDERER = '(^|/)packages/renderer/src/';
const DESKTOP = '(^|/)apps/desktop/src/';
const UNIT_TESTS = '(^|/)(packages|apps)/[^/]+/src/.*\\.test\\.tsx?$';

// Test files and the tests/ tree, except the architecture fixtures, which pose as production code.
const TEST_FILES = ['\\.test\\.tsx?$', '\\.e2e\\.ts$', '(^|/)tests/(?!architecture/fixtures/)'];

const NODE_BUILT_INS = { dependencyTypes: ['core'] };
const REACT = '(^|node_modules/)(react|react-dom|@types/react|@types/react-dom)(/|$)';
const ELECTRON = '(^|node_modules/)electron(/|$)';
const FLUENT = '(^|node_modules/)@fluentui/';
const PLAYWRIGHT = '(^|node_modules/)(playwright|playwright-core|@playwright/test)(/|$)';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'core-imports-nothing-from-node',
      comment: 'AD-14: the core never imports Node. It also has no Node types (see its tsconfig).',
      severity: 'error',
      from: { path: CORE },
      to: NODE_BUILT_INS,
    },
    {
      name: 'core-imports-no-ui-or-host',
      comment: 'AD-14: the core never imports React, Electron or the DOM-bound packages.',
      severity: 'error',
      from: { path: CORE },
      to: { path: [REACT, ELECTRON, FLUENT, HOST_API, RENDERER, DESKTOP] },
    },
    {
      name: 'host-api-imports-no-ui-or-apps',
      comment: 'AD-19: the host interface depends on the core only.',
      severity: 'error',
      from: { path: HOST_API },
      to: { path: [REACT, ELECTRON, FLUENT, RENDERER, DESKTOP] },
    },
    {
      name: 'host-api-imports-nothing-from-node',
      comment: 'AD-19: the interface and its mock run in a browser too.',
      severity: 'error',
      from: { path: HOST_API },
      to: NODE_BUILT_INS,
    },
    {
      name: 'renderer-imports-no-electron-or-node',
      comment: 'AD-14: the renderer reaches the system only through HostApi.',
      severity: 'error',
      from: { path: RENDERER },
      to: { path: [ELECTRON, DESKTOP] },
    },
    {
      name: 'renderer-imports-nothing-from-node',
      comment: 'AD-14: the renderer never imports Node built-ins.',
      severity: 'error',
      from: { path: RENDERER },
      to: NODE_BUILT_INS,
    },
    {
      name: 'main-process-imports-no-react',
      comment: 'AD-14: the Electron main process never imports React or the renderer.',
      severity: 'error',
      from: { path: DESKTOP },
      to: { path: [REACT, FLUENT, RENDERER] },
    },
    {
      name: 'fluent-only-under-ui-fluent',
      comment: 'AD-15: Fluent UI is imported only under renderer/src/ui/fluent/.',
      severity: 'error',
      from: { pathNot: '(^|/)packages/renderer/src/ui/fluent/' },
      to: { path: FLUENT },
    },
    {
      name: 'unit-tests-import-no-electron-or-driver',
      comment: 'AD-14: unit tests import neither Electron nor Playwright, nor a host adapter.',
      severity: 'error',
      from: { path: UNIT_TESTS },
      to: { path: [ELECTRON, PLAYWRIGHT, DESKTOP] },
    },
    {
      name: 'no-production-import-of-tests',
      comment: 'AD-14: test files stay out of builds, so no production file imports one.',
      severity: 'error',
      from: { pathNot: TEST_FILES },
      to: { path: TEST_FILES },
    },
    {
      name: 'packages-do-not-import-apps',
      comment: 'AD-14: apps depend on packages, never the other way around.',
      severity: 'error',
      from: { path: '(^|/)packages/' },
      to: { path: '(^|/)apps/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)tests/architecture/fixtures/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
  },
};
