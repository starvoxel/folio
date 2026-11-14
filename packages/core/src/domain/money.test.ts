// ------------------------------
// money.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import {
  MAX_MONEY_CENTS,
  ZERO_MONEY,
  addMoney,
  isMoney,
  money,
  moneyToDecimalString,
  negateMoney,
  parseMoney,
  subtractMoney,
  sumMoney,
  type Money,
} from './money.js';

const anyMoney = fc
  .integer({ min: -MAX_MONEY_CENTS, max: MAX_MONEY_CENTS })
  .map((cents) => money(cents));
const maxBig = BigInt(MAX_MONEY_CENTS);

/**
 * Add two amounts exactly, with BigInt, as the oracle the checked helpers are compared with.
 * @param left - The first amount.
 * @param right - The second amount.
 * @returns The exact sum.
 */
function exactSum(left: number, right: number): bigint {
  return BigInt(left) + BigInt(right);
}

describe('money', () => {
  describe('wholeCents', () => {
    it('returnsTheSameNumber', () => {
      expect(money(250)).toBe(250);
    });
  });

  describe('negativeZero', () => {
    it('returnsPositiveZero', () => {
      expect(Object.is(money(-0), 0)).toBe(true);
    });
  });

  describe('fraction', () => {
    it('throwsRangeError', () => {
      expect(() => money(1.5)).toThrow(RangeError);
    });
  });

  describe('notANumber', () => {
    it('throwsRangeError', () => {
      expect(() => money(Number.NaN)).toThrow(RangeError);
    });
  });

  describe('beyondTheSafeRange', () => {
    it('throwsRangeError', () => {
      expect(() => money(MAX_MONEY_CENTS + 1)).toThrow(RangeError);
    });
  });
});

describe('isMoney', () => {
  describe('safeInteger', () => {
    it('returnsTrue', () => {
      expect(isMoney(-12)).toBe(true);
    });
  });

  describe('fractionOrText', () => {
    it('returnsFalse', () => {
      expect(isMoney(0.5) || isMoney('5') || isMoney(null)).toBe(false);
    });
  });
});

describe('addMoney', () => {
  describe('twoAmounts', () => {
    it('returnsTheSum', () => {
      expect(addMoney(money(150), money(-50))).toBe(100);
    });
  });

  describe('sumBeyondTheSafeRange', () => {
    it('throwsRangeError', () => {
      expect(() => addMoney(money(MAX_MONEY_CENTS), money(1))).toThrow(RangeError);
    });
  });

  describe('anyTwoAmounts', () => {
    it('agreesWithExactArithmeticOrThrowsRangeError', () => {
      fc.assert(
        fc.property(anyMoney, anyMoney, (left, right) => {
          const exact = exactSum(left, right);
          if (exact > maxBig || exact < -maxBig) {
            expect(() => addMoney(left, right)).toThrow(RangeError);
          } else {
            expect(BigInt(addMoney(left, right))).toBe(exact);
          }
        }),
      );
    });

    it('neverReturnsAnUnsafeInteger', () => {
      fc.assert(
        fc.property(anyMoney, anyMoney, (left, right) => {
          try {
            expect(Number.isSafeInteger(addMoney(left, right))).toBe(true);
          } catch (error) {
            expect(error).toBeInstanceOf(RangeError);
          }
        }),
      );
    });
  });
});

describe('subtractMoney', () => {
  describe('twoAmounts', () => {
    it('returnsTheDifference', () => {
      expect(subtractMoney(money(100), money(250))).toBe(-150);
    });
  });

  describe('differenceBeyondTheSafeRange', () => {
    it('throwsRangeError', () => {
      expect(() => subtractMoney(money(-MAX_MONEY_CENTS), money(1))).toThrow(RangeError);
    });
  });

  describe('addThenSubtract', () => {
    it('roundTripsToTheOriginalWhenTheSumFits', () => {
      fc.assert(
        fc.property(anyMoney, anyMoney, (left, right) => {
          fc.pre(Number.isSafeInteger(left + right));
          expect(subtractMoney(addMoney(left, right), right)).toBe(left);
        }),
      );
    });
  });
});

describe('negateMoney', () => {
  describe('zero', () => {
    it('returnsPositiveZero', () => {
      expect(Object.is(negateMoney(ZERO_MONEY), 0)).toBe(true);
    });
  });

  describe('anyAmount', () => {
    it('isItsOwnInverse', () => {
      fc.assert(fc.property(anyMoney, (value) => negateMoney(negateMoney(value)) === value));
    });

    it('cancelsTheOriginal', () => {
      fc.assert(fc.property(anyMoney, (value) => addMoney(value, negateMoney(value)) === 0));
    });
  });
});

describe('sumMoney', () => {
  describe('emptyList', () => {
    it('returnsZero', () => {
      expect(sumMoney([])).toBe(0);
    });
  });

  describe('smallList', () => {
    it('returnsTheTotal', () => {
      expect(sumMoney([money(100), money(250), money(-75)])).toBe(275);
    });
  });

  describe('partialSumBeyondTheSafeRange', () => {
    it('throwsRangeErrorEvenIfTheTotalFits', () => {
      const values: Money[] = [money(MAX_MONEY_CENTS), money(1), money(-1)];
      expect(() => sumMoney(values)).toThrow(RangeError);
    });
  });
});

describe('parseMoney', () => {
  describe('plainDecimals', () => {
    it('returnsCents', () => {
      expect(parseMoney('12.50')).toEqual({ ok: true, value: 1250 });
      expect(parseMoney('-0.05')).toEqual({ ok: true, value: -5 });
      expect(parseMoney('7')).toEqual({ ok: true, value: 700 });
      expect(parseMoney('+3.1')).toEqual({ ok: true, value: 310 });
    });
  });

  describe('amountsThatAFloatWouldGetWrong', () => {
    it('returnsExactCents', () => {
      // 0.07 * 100 is 7.000000000000001 and 1.15 * 100 is 114.99999999999999 as floats.
      expect(parseMoney('0.07')).toEqual({ ok: true, value: 7 });
      expect(parseMoney('1.15')).toEqual({ ok: true, value: 115 });
    });
  });

  describe('theLargestAmount', () => {
    it('parsesExactlyAndRejectsOneCentMore', () => {
      expect(parseMoney('90071992547409.91')).toEqual({ ok: true, value: MAX_MONEY_CENTS });
      expect(parseMoney('-90071992547409.91')).toEqual({ ok: true, value: -MAX_MONEY_CENTS });
      expect(parseMoney('90071992547409.92')).toMatchObject({
        ok: false,
        error: { code: 'outOfRange' },
      });
    });
  });

  describe('negativeZero', () => {
    it('returnsPositiveZero', () => {
      const result = parseMoney('-0.00');
      expect(result.ok && Object.is(result.value, 0)).toBe(true);
    });
  });

  describe('emptyInput', () => {
    it('returnsAFormatFailure', () => {
      expect(parseMoney('')).toMatchObject({ ok: false, error: { code: 'format' } });
    });
  });

  describe('notADecimal', () => {
    it('returnsAFormatFailure', () => {
      for (const text of ['abc', '1,234.00', '$5.00', '.5', '5.', '1e3', ' 5', '5 ', '(5.00)']) {
        expect(parseMoney(text)).toMatchObject({ ok: false, error: { code: 'format' } });
      }
    });
  });

  describe('moreThanTwoDecimals', () => {
    it('returnsATooManyDecimalsFailure', () => {
      expect(parseMoney('1.234')).toMatchObject({ ok: false, error: { code: 'tooManyDecimals' } });
    });
  });

  describe('aFailure', () => {
    it('doesNotRepeatTheInput', () => {
      const result = parseMoney('4321.987');
      expect(JSON.stringify(result)).not.toContain('4321');
    });
  });

  describe('anyDigitString', () => {
    it('agreesWithExactBigIntArithmetic', () => {
      const digits = fc.stringMatching(/^[0-9]{1,20}$/u);
      const cents = fc.stringMatching(/^[0-9]{2}$/u);
      fc.assert(
        fc.property(fc.constantFrom('', '-', '+'), digits, cents, (sign, whole, fraction) => {
          const expected = BigInt(whole) * 100n + BigInt(fraction);
          const result = parseMoney(`${sign}${whole}.${fraction}`);
          if (expected > maxBig) {
            expect(result).toMatchObject({ ok: false, error: { code: 'outOfRange' } });
          } else {
            const signed = sign === '-' ? -expected : expected;
            expect(result.ok && BigInt(result.value)).toBe(signed);
          }
        }),
        { numRuns: 500 },
      );
    });
  });
});

describe('moneyToDecimalString', () => {
  describe('typicalAmounts', () => {
    it('writesTwoDecimals', () => {
      expect(moneyToDecimalString(money(1250))).toBe('12.50');
      expect(moneyToDecimalString(money(5))).toBe('0.05');
      expect(moneyToDecimalString(money(-5))).toBe('-0.05');
      expect(moneyToDecimalString(ZERO_MONEY)).toBe('0.00');
    });
  });

  describe('theLargestAmount', () => {
    it('writesEveryDigit', () => {
      expect(moneyToDecimalString(money(MAX_MONEY_CENTS))).toBe('90071992547409.91');
    });
  });

  describe('anyAmount', () => {
    it('parsesBackToTheSameAmount', () => {
      fc.assert(
        fc.property(anyMoney, (value) => {
          expect(parseMoney(moneyToDecimalString(value))).toEqual({ ok: true, value });
        }),
        { numRuns: 1000 },
      );
    });
  });
});
