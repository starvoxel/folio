// ------------------------------
// logger.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import {
  combineWriters,
  createLogger,
  parseLogLevel,
  type LogFields,
  type LogLevel,
} from './logger.js';

/**
 * Make a logger that collects its lines.
 * @param level - The logger's level.
 * @returns The logger and the parsed lines it has written.
 */
function collect(
  level: LogLevel,
  appFolder?: string,
): {
  logger: ReturnType<typeof createLogger>;
  lines: Record<string, unknown>[];
  raw: string[];
} {
  const lines: Record<string, unknown>[] = [];
  const raw: string[] = [];
  const logger = createLogger({
    level,
    write: (line) => {
      raw.push(line);
      lines.push(JSON.parse(line) as Record<string, unknown>);
    },
    now: () => Date.UTC(2026, 10, 13, 12, 0, 0),
    ...(appFolder === undefined ? {} : { appFolder }),
  });
  return { logger, lines, raw };
}

const WINDOWS_APP = 'C:\\Users\\Jo Smith\\AppData\\Local\\Folio\\resources\\app.asar';
const MAC_APP = '/Applications/Folio.app/Contents/Resources/app.asar';

/**
 * Make an error with a chosen stack, so a test does not depend on this machine's paths.
 * @param name - The class name.
 * @param message - The message, which must never be logged.
 * @param frames - The frame lines, written after the message line.
 * @param cause - An optional cause.
 * @returns The error.
 */
function errorWithStack(name: string, message: string, frames: string[], cause?: unknown): Error {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  error.name = name;
  error.stack = [`${name}: ${message}`, ...frames].join('\n');
  return error;
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

describe('logError', () => {
  describe('anErrorWithAWindowsStack', () => {
    it('writesNameAndAppRelativeFramesWithoutTheMessage', () => {
      const { logger, lines, raw } = collect('info', WINDOWS_APP);
      const error = errorWithStack('RangeError', 'bad amount "1,234.56" for account 99-8877', [
        `    at parseRow (${WINDOWS_APP}\\dist\\main.cjs:100:7)`,
        '    at async C:\\Users\\Jo Smith\\Documents\\Budget\\helper.js:5:1',
        '    at node:internal/process/task_queues:95:5',
      ]);
      logger.logError('import failed', error, { step: 'parse' });
      expect(lines).toEqual([
        {
          time: '2026-11-13T12:00:00.000Z',
          level: 'error',
          message: 'import failed',
          fields: { step: 'parse' },
          error: {
            name: 'RangeError',
            stack: [
              'at parseRow (<app>/dist/main.cjs:100:7)',
              'at async (helper.js:5:1)',
              'at node:internal/process/task_queues:95:5',
            ],
          },
        },
      ]);
      expect(raw[0]).not.toContain('1,234.56');
      expect(raw[0]).not.toContain('99-8877');
      expect(raw[0]).not.toContain('Jo Smith');
    });
  });

  describe('anErrorWithAMacStack', () => {
    it('writesAppRelativeFramesAndCutsHomePathsToTheFileName', () => {
      const { logger, lines, raw } = collect('info', MAC_APP);
      const error = errorWithStack('TypeError', 'x is not a function', [
        `    at handler (${MAC_APP}/main.cjs:12:3)`,
        '    at run (file:///Users/jo%20smith/Library/Caches/Folio%20Tmp/x.js:1:2)',
        '    at /Users/jo smith/Documents/Smith Family/helper.js:9:9',
      ]);
      logger.logError('failed', error);
      expect((lines[0]?.['error'] as { stack: string[] }).stack).toEqual([
        'at handler (<app>/main.cjs:12:3)',
        'at run (x.js:1:2)',
        'at helper.js:9:9',
      ]);
      expect(raw[0]).not.toContain('jo smith');
      expect(raw[0]).not.toContain('Smith Family');
    });
  });

  describe('anErrorWhoseMessageSpansLinesAndQuotesData', () => {
    it('neverWritesAnyPartOfTheMessage', () => {
      const { logger, raw } = collect('info');
      const error = errorWithStack(
        'SyntaxError',
        'Unexpected "Salary 5200"\nline two: IBAN GB82WEST',
        ['    at parse (a.js:1:1)'],
      );
      logger.logError('parse failed', error);
      expect(raw[0]).not.toContain('Salary');
      expect(raw[0]).not.toContain('GB82WEST');
    });
  });

  describe('anErrorWithASystemCode', () => {
    it('writesTheCodeButNotThePathOrSyscall', () => {
      const { logger, lines, raw } = collect('info');
      const error = Object.assign(
        errorWithStack('Error', "ENOENT: no such file '/Users/jo/a.csv'", []),
        {
          code: 'ENOENT',
          path: '/Users/jo/a.csv',
          syscall: 'open',
        },
      );
      logger.logError('read failed', error);
      expect(lines[0]?.['error']).toEqual({ name: 'Error', code: 'ENOENT', stack: [] });
      expect(raw[0]).not.toContain('a.csv');
    });
  });

  describe('anErrorWhoseCodeOrNameCouldHoldData', () => {
    it('replacesThemSoNoDataIsWritten', () => {
      const { logger, lines } = collect('info');
      const error = Object.assign(errorWithStack('Rent for 4 Elm Street', 'm', []), {
        code: 'owes 1200 to Bob',
      });
      logger.logError('failed', error);
      expect(lines[0]?.['error']).toEqual({ name: 'Error', stack: [] });
    });
  });

  describe('aThrownStringObjectNullOrNumber', () => {
    it('writesTheTypeOnlyNeverTheValue', () => {
      const { logger, lines, raw } = collect('info');
      logger.logError('a', 'secret balance 100');
      logger.logError('b', { account: '12-34' });
      logger.logError('c', null);
      logger.logError('d', undefined);
      logger.logError('e', 42);
      expect(lines.map((line) => line['error'])).toEqual([
        { name: 'NonError', kind: 'string', stack: [] },
        { name: 'NonError', kind: 'object', stack: [] },
        { name: 'NonError', kind: 'object', stack: [] },
        { name: 'NonError', kind: 'undefined', stack: [] },
        { name: 'NonError', kind: 'number', stack: [] },
      ]);
      expect(raw.join('')).not.toContain('secret');
      expect(raw.join('')).not.toContain('12-34');
    });
  });

  describe('anErrorFromAnotherRealmWithAStackString', () => {
    it('isTreatedAsAnError', () => {
      const { logger, lines } = collect('info');
      logger.logError('failed', { name: 'TypeError', stack: 'TypeError: x\n    at f (a.js:1:2)' });
      expect(lines[0]?.['error']).toEqual({ name: 'TypeError', stack: ['at f (a.js:1:2)'] });
    });
  });

  describe('aStackLongerThanTheFrameLimit', () => {
    it('keepsTheFirstFramesAndMarksTheCut', () => {
      const { logger, lines } = collect('info');
      const frames = Array.from({ length: 40 }, (_, index) => `    at f${index} (a.js:${index}:1)`);
      logger.logError('deep', errorWithStack('Error', 'm', frames));
      const logged = lines[0]?.['error'] as { stack: string[]; truncated?: boolean };
      expect(logged.stack).toHaveLength(20);
      expect(logged.truncated).toBe(true);
    });
  });

  describe('aFrameLongerThanTheFieldLimit', () => {
    it('isNotCutAtOneHundredAndTwentyCharacters', () => {
      const { logger, lines } = collect('info', MAC_APP);
      const path = `${MAC_APP}/${'folder/'.repeat(14)}main.cjs`;
      logger.logError('long', errorWithStack('Error', 'm', [`    at handler (${path}:1:2)`]));
      const frame = (lines[0]?.['error'] as { stack: string[] }).stack[0] ?? '';
      expect(frame.length).toBeGreaterThan(120);
      expect(frame.endsWith('main.cjs:1:2)')).toBe(true);
    });
  });

  describe('nestedCauses', () => {
    it('describesEachCauseByTheSameRules', () => {
      const { logger, lines, raw } = collect('info');
      const root = errorWithStack('ParseError', 'value "7,500" invalid', [
        '    at /Users/jo/secret folder/x.js:1:1',
      ]);
      const middle = errorWithStack('ImportError', 'wrapped 7,500', ['    at b (b.js:2:2)'], root);
      const top = errorWithStack('CommandError', 'top 7,500', ['    at c (c.js:3:3)'], middle);
      logger.logError('failed', top);
      expect(lines[0]?.['error']).toEqual({
        name: 'CommandError',
        stack: ['at c (c.js:3:3)'],
        cause: {
          name: 'ImportError',
          stack: ['at b (b.js:2:2)'],
          cause: { name: 'ParseError', stack: ['at x.js:1:1'] },
        },
      });
      expect(raw[0]).not.toContain('7,500');
      expect(raw[0]).not.toContain('secret folder');
    });
  });

  describe('aCauseChainDeeperThanTheLimit', () => {
    it('stopsAfterThreeCausesAndSaysSo', () => {
      const { logger, lines } = collect('info');
      let error: Error = errorWithStack('E5', 'm', []);
      for (const name of ['E4', 'E3', 'E2', 'E1', 'E0']) {
        error = errorWithStack(name, 'm', [], error);
      }
      logger.logError('failed', error);
      expect(lines[0]?.['error']).toEqual({
        name: 'E0',
        stack: [],
        cause: {
          name: 'E1',
          stack: [],
          cause: { name: 'E2', stack: [], cause: { name: 'E3', stack: [], causeOmitted: true } },
        },
      });
    });
  });

  describe('aCauseThatIsAnErrorLoop', () => {
    it('endsAtTheDepthLimit', () => {
      const { logger, lines } = collect('info');
      const error = errorWithStack('Loop', 'm', []);
      error.cause = error;
      logger.logError('failed', error);
      expect(JSON.stringify(lines[0]).length).toBeLessThan(500);
    });
  });

  describe('aNonErrorCause', () => {
    it('isDescribedByItsTypeOnly', () => {
      const { logger, lines, raw } = collect('info');
      logger.logError('failed', errorWithStack('Error', 'm', [], 'balance 5000'));
      expect((lines[0]?.['error'] as { cause: unknown }).cause).toEqual({
        name: 'NonError',
        kind: 'string',
        stack: [],
      });
      expect(raw[0]).not.toContain('5000');
    });
  });

  describe('anErrorWithGettersThatThrow', () => {
    it('stillWritesALineWithWhatCouldBeRead', () => {
      const { logger, lines } = collect('info');
      const error = new Error('m');
      for (const key of ['name', 'stack', 'cause', 'code']) {
        Object.defineProperty(error, key, {
          get: () => {
            throw new Error('boom');
          },
        });
      }
      logger.logError('failed', error);
      expect(lines[0]?.['error']).toEqual({ name: 'Error', stack: [] });
    });
  });

  describe('belowTheLevel', () => {
    it('isDropped', () => {
      const { logger, lines } = collect('error');
      logger.logError('failed', new Error('m'));
      expect(lines).toHaveLength(1);
      const quiet = createLogger({ level: 'error', write: () => undefined, now: () => 0 });
      expect(() => {
        quiet.info('x');
      }).not.toThrow();
    });
  });
});

describe('createLogger', () => {
  describe('aWriterThatThrows', () => {
    it('neverThrowsToTheCaller', () => {
      const logger = createLogger({
        level: 'debug',
        write: () => {
          throw new Error('stderr closed');
        },
        now: () => 0,
      });
      expect(() => {
        logger.info('a');
        logger.logError('b', new Error('c'));
      }).not.toThrow();
    });
  });

  describe('aWriterThatFailsOnlyOnce', () => {
    it('writesAFixedNoticeInsteadOfTheLostLine', () => {
      const lines: string[] = [];
      let failures = 1;
      const logger = createLogger({
        level: 'debug',
        write: (line) => {
          if (failures > 0) {
            failures -= 1;
            throw new Error('first write fails');
          }
          lines.push(line);
        },
        now: () => 0,
      });
      logger.info('lost');
      expect(lines).toEqual(['{"level":"error","message":"a log line could not be written"}']);
    });
  });

  describe('aTimeSourceThatThrowsOrReturnsNotANumber', () => {
    it('stillWritesTheLineWithAnUnknownTime', () => {
      const lines: Record<string, unknown>[] = [];
      const write = (line: string): void =>
        void lines.push(JSON.parse(line) as Record<string, unknown>);
      createLogger({ level: 'info', write, now: () => Number.NaN }).info('a');
      createLogger({
        level: 'info',
        write,
        now: () => {
          throw new Error('clock');
        },
      }).info('b');
      expect(lines.map((line) => [line['time'], line['message']])).toEqual([
        ['unknown', 'a'],
        ['unknown', 'b'],
      ]);
    });
  });

  describe('aMessageWithQuotesNewlinesAndControlCharacters', () => {
    it('staysOneValidJsonLine', () => {
      const { logger, raw, lines } = collect('info');
      logger.info('a "quoted"\nsecond\u0000line', { text: 'x\r\ny' });
      expect(raw[0]).not.toContain('\n');
      expect(lines[0]?.['message']).toBe('a "quoted"\nsecond\u0000line');
    });
  });
});

describe('combineWriters', () => {
  describe('oneWriterThatThrows', () => {
    it('stillCallsTheOthersInOrder', () => {
      const seen: string[] = [];
      const write = combineWriters(
        (line) => void seen.push(`first ${line}`),
        () => {
          throw new Error('broken');
        },
        (line) => void seen.push(`third ${line}`),
      );
      expect(() => {
        write('x');
      }).not.toThrow();
      expect(seen).toEqual(['first x', 'third x']);
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

  describe('aLevelNameInAnotherCase', () => {
    it('returnsThatLevel', () => {
      expect(parseLogLevel('DEBUG')).toBe('debug');
      expect(parseLogLevel(' Warn ')).toBe('warn');
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
