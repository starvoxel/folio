// ------------------------------
// logger.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** How serious a log line is, from most to least verbose. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Extra facts on a log line. Only plain values are accepted, and the messages and values are for
 * operational facts such as a version or a blocked scheme. Never pass file contents, amounts,
 * descriptions or account names: diagnostic logs carry no financial data (AD-10, AD-18).
 */
export type LogFields = Readonly<Record<string, string | number | boolean>>;

/** The main process's logger. */
export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

/** What `createLogger` needs. */
export interface LoggerOptions {
  /** Lines below this level are dropped. */
  readonly level: LogLevel;
  /** Receives one line of JSON at a time. */
  readonly write: (line: string) => void;
  /** The time source, in milliseconds since the epoch. */
  readonly now: () => number;
}

const ORDER: Readonly<Record<LogLevel, number>> = { debug: 10, info: 20, warn: 30, error: 40 };
const MAX_MESSAGE_LENGTH = 300;
const MAX_FIELD_LENGTH = 120;

/**
 * Read a log level from text such as an environment variable.
 * @param text - The text, or undefined when unset.
 * @returns The level; `info` when the text is missing or not a level.
 */
export function parseLogLevel(text: string | undefined): LogLevel {
  return text === 'debug' || text === 'info' || text === 'warn' || text === 'error' ? text : 'info';
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
    const kind = typeof (value as unknown);
    cleaned[key] =
      kind === 'string'
        ? clip(value as string, MAX_FIELD_LENGTH)
        : kind === 'number' || kind === 'boolean'
          ? value
          : '[omitted]';
  }
  return cleaned;
}

/**
 * Create a logger that writes one JSON line per message.
 * @param options - The level, where lines go and the time source.
 * @returns The logger.
 */
export function createLogger(options: LoggerOptions): Logger {
  const log =
    (level: LogLevel) =>
    (message: string, fields?: LogFields): void => {
      if (ORDER[level] < ORDER[options.level]) {
        return;
      }
      options.write(
        JSON.stringify({
          time: new Date(options.now()).toISOString(),
          level,
          message: clip(message, MAX_MESSAGE_LENGTH),
          ...(fields === undefined ? {} : { fields: cleanFields(fields) }),
        }),
      );
    };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}
