// ------------------------------
// logger.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createLogger, parseLogLevel, type LogFields, type LogLevel } from './logger.js';

/**
 * Make a logger that collects its lines.
 * @param level - The logger's level.
 * @returns The logger and the parsed lines it has written.
 */
function collect(level: LogLevel): {
  logger: ReturnType<typeof createLogger>;
  lines: Record<string, unknown>[];
} {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    level,
    write: (line) => void lines.push(JSON.parse(line) as Record<string, unknown>),
    now: () => Date.UTC(2026, 10, 13, 12, 0, 0),
  });
  return { logger, lines };
}

describe('createLogger', () => {
  describe('aLineAtTheConfiguredLevel', () => {
    it('writesOneJsonLineWithTimeLevelAndMessage', () => {
      const { logger, lines } = collect('info');
      logger.info('started', { version: '1.0.0', pid: 42, packaged: true });
      expect(lines).toEqual([
        {
          time: '2026-11-13T12:00:00.000Z',
          level: 'info',
          message: 'started',
          fields: { version: '1.0.0', pid: 42, packaged: true },
        },
      ]);
    });
  });

  describe('aLineBelowTheLevel', () => {
    it('isDropped', () => {
      const { logger, lines } = collect('warn');
      logger.debug('a');
      logger.info('b');
      logger.warn('c');
      logger.error('d');
      expect(lines.map((line) => line['level'])).toEqual(['warn', 'error']);
    });
  });

  describe('debugLevel', () => {
    it('writesEveryLevel', () => {
      const { logger, lines } = collect('debug');
      logger.debug('a');
      expect(lines).toHaveLength(1);
    });
  });

  describe('noFields', () => {
    it('omitsTheFieldsKey', () => {
      const { logger, lines } = collect('info');
      logger.info('plain');
      expect(lines[0]).not.toHaveProperty('fields');
    });
  });

  describe('aFieldThatIsNotAPlainValue', () => {
    it('isReplacedSoNoStructuredDataIsLogged', () => {
      const { logger, lines } = collect('info');
      const sneaky = { account: { number: '123', balance: 1_000_00 }, list: [1, 2] };
      logger.info('oops', sneaky as unknown as LogFields);
      expect(lines[0]?.['fields']).toEqual({ account: '[omitted]', list: '[omitted]' });
      expect(JSON.stringify(lines[0])).not.toContain('123');
    });
  });

  describe('aVeryLongMessageAndField', () => {
    it('isClipped', () => {
      const { logger, lines } = collect('info');
      logger.info('m'.repeat(1000), { text: 'f'.repeat(1000) });
      expect(String(lines[0]?.['message']).length).toBeLessThan(310);
      expect(String((lines[0]?.['fields'] as Record<string, unknown>)['text']).length).toBeLessThan(
        130,
      );
    });
  });
});

describe('parseLogLevel', () => {
  describe('aLevelName', () => {
    it('returnsThatLevel', () => {
      expect(parseLogLevel('debug')).toBe('debug');
      expect(parseLogLevel('error')).toBe('error');
    });
  });

  describe('missingOrUnknownText', () => {
    it('returnsInfo', () => {
      expect(parseLogLevel(undefined)).toBe('info');
      expect(parseLogLevel('')).toBe('info');
      expect(parseLogLevel('verbose')).toBe('info');
    });
  });
});
