// ------------------------------
// logger.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { FolioError } from '@folio/core';

import { scrubStack } from './log-stack.js';

/** How serious a log line is, from most to least verbose. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A value the caller wants kept out of the log line. The line shows `[private]` in its place. It
 * exists so a value that may be needed for debugging is marked at the call site, where a later
 * milestone can seal it for the owner (plans/logging.md); until then it is never written.
 */
export class PrivateField {
  /** The value kept out of the log. */
  public readonly value: string | number | boolean;

  /** @param value - The value to keep out of the log. */
  public constructor(value: string | number | boolean) {
    this.value = value;
  }
}

/**
 * Mark a field value as private.
 * @param value - The value.
 * @returns A marker that the logger writes as `[private]`.
 */
export function privateField(value: string | number | boolean): PrivateField {
  return new PrivateField(value);
}

/**
 * Extra facts on a log line. Only plain values are accepted, and the messages and values are for
 * operational facts such as a version or a blocked scheme. Never pass file contents, amounts,
 * descriptions or account names: diagnostic logs carry no financial data (AD-10, AD-18). A value
 * that should stay out of the line is marked with `privateField`.
 */
export type LogFields = Readonly<Record<string, string | number | boolean | PrivateField>>;

/**
 * What a logged error looks like: its class name, an optional system code, the frames of its stack
 * and its causes. There is never a message, a path outside the app folder or any other property.
 */
export interface LoggedError {
  /**
   * The message, only for a `FolioError`, whose message follows the message standard and is
   * written as it is. Every other error's message is never written.
   */
  readonly message?: string;
  /** The error's class name when it looks like an identifier, else `Error`; `NonError` for a thrown value that was not an error. */
  readonly name: string;
  /** The `typeof` of a thrown value that was not an error. */
  readonly kind?: string;
  /** A system error code such as `ENOENT`, when the error has one that looks like a code. */
  readonly code?: string;
  /** The stack frames, made safe by `scrubStack`; empty when there are none. */
  readonly stack: readonly string[];
  /** True when frames were left out because the stack was longer than the limit. */
  readonly truncated?: true;
  /** The error's `cause`, described by the same rules. */
  readonly cause?: LoggedError;
  /** True when the cause chain went deeper than the limit and the rest was left out. */
  readonly causeOmitted?: true;
}

/** The main process's logger. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  /**
   * Log an error at the `error` level. Only the error's name, code and stack frames are written,
   * never its message, because a message can quote data (AD-10). Use this for anything caught.
   * @param message - What the app was doing, as fixed text.
   * @param error - The caught value, which may not be an error at all.
   * @param fields - Extra plain facts, as for `error`.
   */
  logError(message: string, error: unknown, fields?: LogFields): void;
}

/** What `createLogger` needs. */
export interface LoggerOptions {
  /** Lines below this level are dropped. */
  readonly level: LogLevel;
  /** Receives one line of JSON at a time. */
  readonly write: (line: string) => void;
  /** The time source, in milliseconds since the epoch. */
  readonly now: () => number;
  /**
   * The folder the app is installed in. Stack paths below it are kept; every other path is cut to
   * its file name (see `scrubPath`).
   */
  readonly appFolder?: string;
}

const ORDER: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };
// Keep a line small enough to read in a terminal and to attach to a bug report, and make a stray
// long value (a file path, a pasted description) get cut instead of written whole. The numbers are
// judgement, not measured; raise them when a real message needs more.
const MAX_MESSAGE_LENGTH = 300;
const MAX_FIELD_LENGTH = 120;
// Stacks have their own limits, so the 120 characters of a field never cut a frame in half. Frame
// length and count are in log-stack.ts. A cause chain of more than a few links is a loop or noise.
const MAX_CAUSE_DEPTH = 3;
const ERROR_NAME = /^[A-Za-z_$][\w$]{0,59}$/u;
const ERROR_CODE = /^[A-Z][A-Z0-9_]{1,39}$/u;
// Written when a line cannot be built or written. It is fixed text, with no time, because the time
// source may be what failed.
const FALLBACK_LINE = '{"level":"error","message":"a log line could not be written"}';

/**
 * Read a log level from text such as an environment variable.
 * @param text - The text, or undefined when unset. Case and surrounding spaces do not matter.
 * @returns The level; `info` when the text is missing or not a level.
 */
export function parseLogLevel(text: string | undefined): LogLevel {
  const name = text?.trim().toLowerCase();
  return name === 'debug' || name === 'info' || name === 'warn' || name === 'error' ? name : 'info';
}

/**
 * Shorten text so one log line stays small.
 * @param text - The text.
 * @param limit - The longest allowed length.
 * @returns The text, cut with an ellipsis when it was longer than the limit.
 */
function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

/**
 * Turn the fields of a line into safe values: plain values only, strings clipped.
 * @param fields - The fields given by the caller, which may break the type at run time.
 * @returns The cleaned fields.
 */
function cleanFields(fields: LogFields | undefined): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    // The value may break its type at run time, so check what it really is.
    const raw: unknown = value;
    if (typeof raw === 'string') {
      cleaned[key] = clip(raw, MAX_FIELD_LENGTH);
    } else if (typeof raw === 'number' || typeof raw === 'boolean') {
      cleaned[key] = raw;
    } else {
      cleaned[key] = raw instanceof PrivateField ? '[private]' : '[omitted]';
    }
  }
  return cleaned;
}

/**
 * Read something that may throw, such as a getter on a hostile or broken error.
 * @param get - The read.
 * @returns The value, or undefined when the read threw.
 */
function read<Value>(get: () => Value): Value | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}

/**
 * Describe a thrown value for the log: name, code and stack frames, and its causes, never the
 * message. A value that is not an error is described by its type only, because a thrown string or
 * object can hold anything.
 * @param value - The thrown value.
 * @param appFolder - The folder the app is installed in, or undefined when unknown.
 * @param depth - How many causes deep this value is.
 * @returns The description.
 */
function describeError(value: unknown, appFolder: string | undefined, depth: number): LoggedError {
  const stack =
    typeof value === 'object' && value !== null ? read(() => (value as Error).stack) : undefined;
  if (typeof stack !== 'string' && !(value instanceof Error)) {
    return { name: 'NonError', kind: typeof value, stack: [] };
  }
  const error = value as Error;
  const message = error instanceof FolioError ? read(() => error.message) : undefined;
  const name = read(() => error.name);
  const code = read(() => (error as { code?: unknown }).code);
  const cause = read(() => error.cause);
  const scrubbed = typeof stack === 'string' ? scrubStack(stack, appFolder) : undefined;
  return {
    name: typeof name === 'string' && ERROR_NAME.test(name) ? name : 'Error',
    ...(typeof message === 'string' ? { message: clip(message, MAX_MESSAGE_LENGTH) } : {}),
    ...(typeof code === 'string' && ERROR_CODE.test(code) ? { code } : {}),
    stack: scrubbed?.frames ?? [],
    ...(scrubbed?.truncated === true ? { truncated: true as const } : {}),
    ...(cause === undefined
      ? {}
      : depth >= MAX_CAUSE_DEPTH
        ? { causeOmitted: true as const }
        : { cause: describeError(cause, appFolder, depth + 1) }),
  };
}

/**
 * Join several writers into one. A writer that throws does not stop the others.
 * @param writers - The writers, such as standard error and a log file.
 * @returns One writer that calls each of them.
 */
export function combineWriters(
  ...writers: readonly ((line: string) => void)[]
): (line: string) => void {
  return (line) => {
    for (const write of writers) {
      try {
        write(line);
      } catch {
        // One failing destination must not take the others down with it.
      }
    }
  };
}

/**
 * Create a logger that writes one JSON line per message. The logger never throws: a line that
 * cannot be built or written is replaced by a fixed notice, and if that fails too it is dropped,
 * because a diagnostic must not be able to stop the app.
 * @param options - The level, where lines go, the time source and the app folder.
 * @returns The logger.
 */
export function createLogger(options: LoggerOptions): Logger {
  const emit = (
    level: LogLevel,
    message: string,
    fields?: LogFields,
    error?: { value: unknown },
  ): void => {
    try {
      if (ORDER[level] < ORDER[options.level]) {
        return;
      }
      options.write(
        JSON.stringify({
          time: read(() => new Date(options.now()).toISOString()) ?? 'unknown',
          level,
          message: clip(message, MAX_MESSAGE_LENGTH),
          ...(fields === undefined ? {} : { fields: cleanFields(fields) }),
          ...(error === undefined
            ? {}
            : { error: describeError(error.value, options.appFolder, 0) }),
        }),
      );
    } catch {
      try {
        options.write(FALLBACK_LINE);
      } catch {
        // Nothing left to try; dropping the line is the only safe choice.
      }
    }
  };
  const log =
    (level: LogLevel) =>
    (message: string, fields?: LogFields): void => {
      emit(level, message, fields);
    };
  return {
    debug: log('debug'),
    info: log('info'),
    warn: log('warn'),
    error: log('error'),
    logError: (message, error, fields) => {
      emit('error', message, fields, { value: error });
    },
  };
}
