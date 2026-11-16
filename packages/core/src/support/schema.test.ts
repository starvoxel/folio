// ------------------------------
// schema.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  localDateSchema,
  idSchema,
  moneySchema,
  parseWithSchema,
  yearMonthSchema,
} from './schema.js';

const accountSchema = z.strictObject({
  id: idSchema<'Account'>(),
  opened: localDateSchema,
  balance: moneySchema,
});
const sampleId = '3f2b8c1e-5a4d-4e6f-9a7b-0c1d2e3f4a5b';

describe('parseWithSchema', () => {
  describe('validInput', () => {
    it('returnsTheBrandedValues', () => {
      const result = parseWithSchema(accountSchema, {
        id: sampleId,
        opened: '2026-01-31',
        balance: 12_345,
      });
      expect(result).toEqual({
        ok: true,
        value: { id: sampleId, opened: '2026-01-31', balance: 12_345 },
      });
    });
  });

  describe('emptyInput', () => {
    it('returnsInvalidWithAnIssuePerField', () => {
      const result = parseWithSchema(accountSchema, {});
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issues.map((issue) => issue.path).sort()).toEqual([
          'balance',
          'id',
          'opened',
        ]);
      }
    });
  });

  describe('aNonObject', () => {
    it('returnsInvalid', () => {
      expect(parseWithSchema(accountSchema, null)).toMatchObject({ ok: false });
      expect(parseWithSchema(accountSchema, 'text')).toMatchObject({ ok: false });
    });
  });

  describe('aFractionalAmount', () => {
    it('namesTheFieldAndDoesNotRepeatTheValue', () => {
      const result = parseWithSchema(accountSchema, {
        id: sampleId,
        opened: '2026-01-31',
        balance: 1234.5,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.issues).toEqual([
          { path: 'balance', message: 'Not a safe integer count of cents' },
        ]);
        expect(JSON.stringify(result.error)).not.toContain('1234');
      }
    });
  });

  describe('anUnknownField', () => {
    it('returnsInvalid', () => {
      const result = parseWithSchema(accountSchema, {
        id: sampleId,
        opened: '2026-01-31',
        balance: 1,
        extra: true,
      });
      expect(result.ok).toBe(false);
    });
  });
});

describe('moneySchema', () => {
  describe('aStringAmount', () => {
    it('returnsInvalid', () => {
      expect(parseWithSchema(moneySchema, '12')).toMatchObject({ ok: false });
    });
  });
});

describe('localDateSchema', () => {
  describe('anImpossibleDate', () => {
    it('returnsInvalid', () => {
      expect(parseWithSchema(localDateSchema, '2026-02-30')).toMatchObject({ ok: false });
      expect(parseWithSchema(localDateSchema, 20_260_213)).toMatchObject({ ok: false });
    });
  });
});

describe('yearMonthSchema', () => {
  describe('aRealMonth', () => {
    it('returnsTheMonth', () => {
      expect(parseWithSchema(yearMonthSchema, '2026-11')).toEqual({ ok: true, value: '2026-11' });
    });
  });

  describe('monthThirteen', () => {
    it('returnsInvalid', () => {
      expect(parseWithSchema(yearMonthSchema, '2026-13')).toMatchObject({ ok: false });
    });
  });
});

describe('idSchema', () => {
  describe('notAUuid', () => {
    it('returnsInvalid', () => {
      expect(parseWithSchema(idSchema<'Account'>(), 'abc')).toMatchObject({ ok: false });
    });
  });
});
