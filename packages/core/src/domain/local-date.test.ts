// ------------------------------
// local-date.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  addMonths,
  daysInMonth,
  firstDayOf,
  isLeapYear,
  lastDayOf,
  localDate,
  localDateParts,
  parseLocalDate,
  parseYearMonth,
  yearMonth,
  yearMonthFromParts,
  yearMonthOf,
} from './local-date.js';

const anyYear = fc.integer({ min: 1, max: 9999 });
const anyMonth = fc.integer({ min: 1, max: 12 });

describe('isLeapYear', () => {
  describe('centuryYears', () => {
    it('followsTheFourHundredRule', () => {
      expect(isLeapYear(1900)).toBe(false);
      expect(isLeapYear(2000)).toBe(true);
      expect(isLeapYear(2100)).toBe(false);
    });
  });

  describe('otherYears', () => {
    it('followsTheFourYearRule', () => {
      expect(isLeapYear(2024)).toBe(true);
      expect(isLeapYear(2026)).toBe(false);
    });
  });
});

describe('daysInMonth', () => {
  describe('february', () => {
    it('hasTwentyNineDaysInALeapYear', () => {
      expect(daysInMonth(2024, 2)).toBe(29);
      expect(daysInMonth(2026, 2)).toBe(28);
    });
  });

  describe('longAndShortMonths', () => {
    it('countsThirtyOrThirtyOne', () => {
      expect(daysInMonth(2026, 1)).toBe(31);
      expect(daysInMonth(2026, 4)).toBe(30);
    });
  });

  describe('aMonthOutsideOneToTwelve', () => {
    it('throwsRangeError', () => {
      expect(() => daysInMonth(2026, 0)).toThrow(RangeError);
      expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
      expect(() => daysInMonth(2026, 1.5)).toThrow(RangeError);
    });
  });
});

describe('parseLocalDate', () => {
  describe('realDates', () => {
    it('returnsTheDate', () => {
      expect(parseLocalDate('2026-11-13')).toEqual({ ok: true, value: '2026-11-13' });
      expect(parseLocalDate('2024-02-29')).toEqual({ ok: true, value: '2024-02-29' });
      expect(parseLocalDate('0001-01-01')).toEqual({ ok: true, value: '0001-01-01' });
    });
  });

  describe('datesThatDoNotExist', () => {
    it('returnsAnOutOfRangeFailure', () => {
      for (const text of [
        '2026-02-29',
        '2100-02-29',
        '2026-13-01',
        '2026-00-10',
        '2026-04-31',
        '0000-01-01',
      ]) {
        expect(parseLocalDate(text)).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
      }
    });
  });

  describe('emptyInput', () => {
    it('returnsAFormatFailure', () => {
      expect(parseLocalDate('')).toMatchObject({ ok: false, error: { code: 'format' } });
    });
  });

  describe('otherShapes', () => {
    it('returnsAFormatFailure', () => {
      for (const text of [
        '2026-1-1',
        '26-11-13',
        '2026/11/13',
        '2026-11-13T00:00',
        ' 2026-11-13',
      ]) {
        expect(parseLocalDate(text)).toMatchObject({ ok: false, error: { code: 'format' } });
      }
    });
  });

  describe('anyRealDate', () => {
    it('isAcceptedAndKeepsItsParts', () => {
      fc.assert(
        fc.property(anyYear, anyMonth, fc.integer({ min: 1, max: 28 }), (year, month, day) => {
          const text = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const result = parseLocalDate(text);
          expect(result.ok && localDateParts(result.value)).toEqual({ year, month, day });
        }),
      );
    });
  });
});

describe('localDate', () => {
  describe('realDate', () => {
    it('returnsTheDate', () => {
      expect(localDate('2026-11-13')).toBe('2026-11-13');
    });
  });

  describe('impossibleDate', () => {
    it('throwsRangeError', () => {
      expect(() => localDate('2026-02-30')).toThrow(RangeError);
    });
  });
});

describe('parseYearMonth', () => {
  describe('realMonth', () => {
    it('returnsTheMonth', () => {
      expect(parseYearMonth('2026-11')).toEqual({ ok: true, value: '2026-11' });
    });
  });

  describe('monthThirteen', () => {
    it('returnsAnOutOfRangeFailure', () => {
      expect(parseYearMonth('2026-13')).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
      expect(parseYearMonth('0000-05')).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
    });
  });

  describe('emptyInput', () => {
    it('returnsAFormatFailure', () => {
      expect(parseYearMonth('')).toMatchObject({ ok: false, error: { code: 'format' } });
      expect(parseYearMonth('2026-11-01')).toMatchObject({ ok: false, error: { code: 'format' } });
    });
  });
});

describe('yearMonth', () => {
  describe('realMonth', () => {
    it('returnsTheMonth', () => {
      expect(yearMonth('2026-11')).toBe('2026-11');
    });
  });

  describe('impossibleMonth', () => {
    it('throwsRangeError', () => {
      expect(() => yearMonth('2026-00')).toThrow(RangeError);
    });
  });
});

describe('yearMonthOf', () => {
  describe('aDate', () => {
    it('returnsItsMonth', () => {
      expect(yearMonthOf(localDate('2026-11-13'))).toBe('2026-11');
    });
  });
});

describe('yearMonthFromParts', () => {
  describe('smallYear', () => {
    it('padsToFourDigits', () => {
      expect(yearMonthFromParts(7, 3)).toBe('0007-03');
    });
  });

  describe('yearOutsideTheRange', () => {
    it('throwsRangeError', () => {
      expect(() => yearMonthFromParts(0, 1)).toThrow(RangeError);
      expect(() => yearMonthFromParts(10000, 1)).toThrow(RangeError);
    });
  });
});

describe('addMonths', () => {
  describe('acrossAYearEnd', () => {
    it('rollsTheYear', () => {
      expect(addMonths(yearMonth('2026-11'), 2)).toBe('2027-01');
      expect(addMonths(yearMonth('2026-01'), -1)).toBe('2025-12');
    });
  });

  describe('zeroMonths', () => {
    it('returnsTheSameMonth', () => {
      expect(addMonths(yearMonth('2026-06'), 0)).toBe('2026-06');
    });
  });

  describe('pastTheLastYear', () => {
    it('throwsRangeError', () => {
      expect(() => addMonths(yearMonth('9999-12'), 1)).toThrow(RangeError);
    });
  });

  describe('movingThereAndBack', () => {
    it('returnsTheStartingMonth', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 100, max: 9000 }),
          anyMonth,
          fc.integer({ min: -600, max: 600 }),
          (year, month, count) => {
            const start = yearMonthFromParts(year, month);
            expect(addMonths(addMonths(start, count), -count)).toBe(start);
          },
        ),
      );
    });
  });
});

describe('firstDayOf', () => {
  describe('aMonth', () => {
    it('returnsTheFirst', () => {
      expect(firstDayOf(yearMonth('2026-11'))).toBe('2026-11-01');
    });
  });
});

describe('lastDayOf', () => {
  describe('leapFebruary', () => {
    it('returnsTheTwentyNinth', () => {
      expect(lastDayOf(yearMonth('2024-02'))).toBe('2024-02-29');
    });
  });

  describe('anyMonth', () => {
    it('returnsARealDateInThatMonth', () => {
      fc.assert(
        fc.property(anyYear, anyMonth, (year, month) => {
          const value = yearMonthFromParts(year, month);
          const last = parseLocalDate(lastDayOf(value));
          expect(last.ok && yearMonthOf(last.value)).toBe(value);
        }),
      );
    });
  });
});
