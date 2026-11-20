// ------------------------------
// layout-code.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** One thing a source file does that it must not, with the pattern that finds it. */
interface Pattern {
  readonly description: string;
  readonly pattern: RegExp;
}

/** What a screen may not contain: it describes content, and shells and page layouts arrange it. */
const SCREEN_PATTERNS: readonly Pattern[] = [
  { description: 'a media or container query', pattern: /@(media|container)\b/u },
  { description: 'matchMedia or useMediaQuery', pattern: /\b(matchMedia|useMediaQuery)\b/u },
  {
    description: 'a read of a window or element size',
    pattern:
      /\b(inner|outer)(Width|Height)\b|\b(client|offset|scroll)(Width|Height)\b|\bgetBoundingClientRect\b/u,
  },
  { description: 'a resize observer', pattern: /\bResizeObserver\b/u },
  { description: 'the layout hook', pattern: /\buseLayout\b/u },
  { description: 'the form-factor profile', pattern: /\bformFactor\b/u },
  { description: 'a class name', pattern: /\bclassName\s*=/u },
  { description: 'an inline style', pattern: /\bstyle\s*[=:]/u },
  { description: 'a style sheet import', pattern: /from\s+['"][^'"]+\.css['"]/u },
];

/** What the pure layout logic may not touch: the page, the window or the browser. */
const LOGIC_PATTERNS: readonly Pattern[] = [
  {
    description: 'a browser global',
    pattern: /\b(window|document|navigator|globalThis|localStorage|sessionStorage)\b/u,
  },
  { description: 'matchMedia', pattern: /\bmatchMedia\b/u },
  { description: 'a resize observer', pattern: /\bResizeObserver\b/u },
];

/**
 * Remove comments, so a sentence that explains a rule is not mistaken for breaking it.
 * @param source - The source text.
 * @returns The source without block and line comments.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/(^|[^:])\/\/.*$/gmu, '$1');
}

/**
 * Describe each way the source breaks the patterns.
 * @param source - The source text.
 * @param patterns - What must not appear.
 * @returns One line per pattern found.
 */
function findProblems(source: string, patterns: readonly Pattern[]): string[] {
  const code = stripComments(source);
  return patterns.filter(({ pattern }) => pattern.test(code)).map(({ description }) => description);
}

/**
 * Find layout code in a screen (AD-21).
 * @param source - The screen's source text.
 * @returns What it contains that only a shell or a page layout may contain; empty when clean.
 */
export function findScreenLayoutProblems(source: string): string[] {
  return findProblems(source, SCREEN_PATTERNS);
}

/**
 * Find browser access in the pure layout logic (AD-21).
 * @param source - The layout module's source text.
 * @returns What it touches that pure logic may not; empty when clean.
 */
export function findLayoutLogicProblems(source: string): string[] {
  return findProblems(source, LOGIC_PATTERNS);
}
