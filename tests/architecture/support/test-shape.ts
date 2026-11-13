// ------------------------------
// test-shape.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import ts from 'typescript';

const SUITE_NAMES = new Set(['describe', 'test.describe']);
const CASE_NAMES = new Set(['it', 'test']);
const HOOK_NAMES = new Set([
  'beforeAll',
  'beforeEach',
  'afterAll',
  'afterEach',
  'test.beforeAll',
  'test.beforeEach',
  'test.afterAll',
  'test.afterEach',
]);
const NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.]*$/u;

/**
 * Read the dotted name of a call target, such as `describe`, `it.each` or `test.describe`.
 * @param expression - The callee of a call expression.
 * @returns The dotted name, or null when the callee is not a plain identifier chain.
 */
function calleeName(expression: ts.Expression): string | null {
  if (ts.isIdentifier(expression)) {
    return expression.text;
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const left = calleeName(expression.expression);
    return left === null ? null : `${left}.${expression.name.text}`;
  }
  if (ts.isCallExpression(expression)) {
    // it.each([...])('name', fn): the call target is itself a call.
    return calleeName(expression.expression);
  }
  return null;
}

/**
 * Find the callback and name argument of a suite or case call.
 * @param call - The call expression.
 * @returns The first argument and the function argument, when present.
 */
function readArguments(call: ts.CallExpression): {
  name: ts.Expression | undefined;
  body: ts.ArrowFunction | ts.FunctionExpression | undefined;
} {
  const [name, second, third] = call.arguments;
  const candidates = [second, third];
  const body = candidates.find(
    (argument): argument is ts.ArrowFunction | ts.FunctionExpression =>
      argument !== undefined && (ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)),
  );
  return { name, body };
}

/**
 * Check one name argument: it must be a string literal in identifier form.
 * @param name - The argument expression.
 * @param level - The level the name belongs to, for the message.
 * @returns A problem description, or null.
 */
function checkName(name: ts.Expression | undefined, level: string): string | null {
  if (name === undefined || !ts.isStringLiteralLike(name)) {
    return `the ${level} name must be a string literal`;
  }
  if (!NAME_PATTERN.test(name.text)) {
    return `the ${level} name "${name.text}" must be a single identifier such as parseAmount`;
  }
  return null;
}

/**
 * Check that a test file follows the three-level shape of project-standards.md: `describe` the
 * subject, `describe` the condition, `it` the expected result.
 * @param sourceText - The source of the test file.
 * @param fileName - The file name, used by the TypeScript parser to choose the language variant.
 * @returns One message per problem found; empty when the file follows the shape.
 */
export function findShapeProblems(sourceText: string, fileName: string): string[] {
  const file = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2023, true);
  const problems: string[] = [];

  const callsIn = (statements: readonly ts.Statement[]): ts.CallExpression[] =>
    statements.flatMap((statement) =>
      ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)
        ? [statement.expression]
        : [],
    );

  const visitCase = (call: ts.CallExpression, level: string): void => {
    const { name } = readArguments(call);
    const problem = checkName(name, level);
    if (problem !== null) {
      problems.push(problem);
    }
  };

  const visitSuiteBody = (
    body: ts.ArrowFunction | ts.FunctionExpression | undefined,
    depth: 1 | 2,
  ): void => {
    if (body === undefined || !ts.isBlock(body.body)) {
      problems.push(`the level ${String(depth)} describe needs a block body`);
      return;
    }
    const calls = callsIn(body.body.statements);
    if (calls.length === 0) {
      problems.push(`a level ${String(depth)} describe is empty`);
    }
    for (const call of calls) {
      const target = calleeName(call.expression) ?? '';
      if (HOOK_NAMES.has(target)) {
        continue;
      }
      if (depth === 1) {
        if (SUITE_NAMES.has(target)) {
          visitSuite(call, 2);
        } else {
          problems.push(
            `"${target}" at level 2: only describe (the condition) may follow the subject`,
          );
        }
      } else if (CASE_NAMES.has(target) || target.startsWith('it.') || target.startsWith('test.')) {
        if (SUITE_NAMES.has(target)) {
          problems.push('a describe at level 3: the shape has only three levels');
        } else {
          visitCase(call, 'expected result');
        }
      } else {
        problems.push(
          `"${target}" at level 3: only it (the expected result) may follow the condition`,
        );
      }
    }
  };

  const visitSuite = (call: ts.CallExpression, depth: 1 | 2): void => {
    const { name, body } = readArguments(call);
    const problem = checkName(name, depth === 1 ? 'subject' : 'condition');
    if (problem !== null) {
      problems.push(problem);
    }
    visitSuiteBody(body, depth);
  };

  const topLevel = callsIn(file.statements);
  if (topLevel.length === 0) {
    problems.push('the file has no top-level describe');
  }
  for (const call of topLevel) {
    const target = calleeName(call.expression) ?? '';
    if (HOOK_NAMES.has(target)) {
      continue;
    }
    if (SUITE_NAMES.has(target)) {
      visitSuite(call, 1);
    } else {
      problems.push(`"${target}" at the top level: a test file starts with describe (the subject)`);
    }
  }
  return problems;
}
