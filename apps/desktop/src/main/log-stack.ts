// ------------------------------
// log-stack.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** The most frames one stack may log. V8 keeps ten by default, so this is a ceiling, not a target. */
export const MAX_STACK_FRAMES = 20;
// A frame longer than this is cut. The numbers here are judgement, not measured: a bundled frame
// such as `at Object.handler (<app>/main.cjs:12345:67)` is about 50 characters.
const MAX_FRAME_LENGTH = 200;
const MAX_FUNCTION_LENGTH = 80;
const MAX_PATH_LENGTH = 120;
// What a function name may contain. No slash, backslash, quote or parenthesis, so a path or a
// value cannot hide in it.
const FUNCTION_NAME = /^[\w$.<>[\]: -]+$/u;
const NODE_INTERNAL = /^node:[\w/.-]+$/u;
const LOCATION = /^(.*?)(?::(\d+))?(?::(\d+))?$/u;

/** A stack made safe to log. */
export interface ScrubbedStack {
  /** The frames, at most `MAX_STACK_FRAMES`, each rewritten by `scrubFrame`. */
  readonly frames: readonly string[];
  /** True when frames were left out because there were more than the limit. */
  readonly truncated: boolean;
}

/**
 * Turn a path or URL from a stack frame into text that holds no personal data.
 *
 * A path below the app folder keeps its folders (`<app>/main.cjs`), because they only show how
 * the code is laid out. Every other path, below the user's home folder, the temp folder or
 * anywhere unknown, can hold a user name or a folder a person named, so it keeps only its file
 * name. Paths are understood in Windows and POSIX shapes and as `file://` URLs.
 * @param raw - The path as written in the frame.
 * @param appFolder - The folder the app is installed in, or undefined when unknown.
 * @returns The safe text.
 */
export function scrubPath(raw: string, appFolder: string | undefined): string {
  if (raw === '<anonymous>' || raw === 'native' || NODE_INTERNAL.test(raw)) {
    return raw;
  }
  const path = toPlainPath(raw);
  const root = appFolder === undefined ? '' : toPlainPath(appFolder).replace(/\/+$/u, '');
  if (root !== '' && path.toLowerCase().startsWith(`${root.toLowerCase()}/`)) {
    return clip(`<app>/${path.slice(root.length + 1)}`, MAX_PATH_LENGTH);
  }
  const fileName = path.slice(path.lastIndexOf('/') + 1);
  return fileName === '' ? '<unknown>' : clip(fileName, MAX_PATH_LENGTH);
}

/**
 * Rewrite one stack frame so it holds only a function name, a safe path, a line and a column.
 * @param line - One line of a stack.
 * @param appFolder - The folder the app is installed in, or undefined when unknown.
 * @returns The rewritten frame, or undefined when the line is not a frame (a message line).
 */
export function scrubFrame(line: string, appFolder: string | undefined): string | undefined {
  const text = line.trim();
  if (!text.startsWith('at ')) {
    return undefined;
  }
  const rest = text.slice(3);
  let name = '';
  let where = rest;
  const open = rest.endsWith(')') ? rest.indexOf(' (') : -1;
  if (open > 0) {
    name = rest.slice(0, open);
    where = rest.slice(open + 2, -1);
  } else if (rest.startsWith('async ')) {
    name = 'async';
    where = rest.slice(6);
  }
  const location = where.startsWith('eval at ') ? '<eval>' : describeLocation(where, appFolder);
  const safeName = FUNCTION_NAME.test(name) ? clip(name, MAX_FUNCTION_LENGTH) : '';
  const frame = safeName === '' ? `at ${location}` : `at ${safeName} (${location})`;
  return clip(frame, MAX_FRAME_LENGTH);
}

/**
 * Keep only the frames of a stack. The first lines of a stack are the error's message, which can
 * hold data (a parse error that quotes a value) and can span several lines, so every line that is
 * not a frame is dropped.
 * @param stack - The stack text.
 * @param appFolder - The folder the app is installed in, or undefined when unknown.
 * @returns The safe frames.
 */
export function scrubStack(stack: string, appFolder: string | undefined): ScrubbedStack {
  const frames: string[] = [];
  let truncated = false;
  for (const line of stack.split('\n')) {
    const frame = scrubFrame(line, appFolder);
    if (frame === undefined) {
      continue;
    }
    if (frames.length === MAX_STACK_FRAMES) {
      truncated = true;
      break;
    }
    frames.push(frame);
  }
  return { frames, truncated };
}

/**
 * Rewrite `path:line:column`, keeping the numbers.
 * @param where - The location text of a frame.
 * @param appFolder - The folder the app is installed in, or undefined when unknown.
 * @returns The safe location.
 */
function describeLocation(where: string, appFolder: string | undefined): string {
  const [, path = '', line, column] = LOCATION.exec(where) ?? [];
  const numbers = [line, column].filter((part) => part !== undefined).join(':');
  return `${scrubPath(path, appFolder)}${numbers === '' ? '' : `:${numbers}`}`;
}

/**
 * Turn a path or `file://` URL into one shape: forward slashes, no scheme, no leading slash before
 * a drive letter.
 * @param raw - The path or URL.
 * @returns The plain path.
 */
function toPlainPath(raw: string): string {
  let path = raw;
  if (path.toLowerCase().startsWith('file://')) {
    path = path.slice('file://'.length);
    try {
      path = decodeURIComponent(path);
    } catch {
      // A broken escape: match on the text as it is.
    }
    path = path.replace(/^\/(?=[A-Za-z]:)/u, '');
  }
  return path.replaceAll('\\', '/');
}

/**
 * Shorten text so one frame stays small.
 * @param text - The text.
 * @param limit - The longest allowed length.
 * @returns The text, cut with an ellipsis when it was longer than the limit.
 */
function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}
