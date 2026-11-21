// ------------------------------
// log-message-mask.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-21
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { maskMessage } from './log-message-mask.js';
import { LOG_VOCABULARY, POSITION_WORDS } from './log-vocabulary.js';

describe('maskMessage', () => {
  describe('aV8TypeErrorMessage', () => {
    it('keepsTheStructureAndHidesThePropertyName', () => {
      expect(maskMessage("Cannot read properties of undefined (reading 'theme')")).toBe(
        "Cannot read properties of undefined (reading '<?>')",
      );
      expect(maskMessage('x is not a function')).toBe('<?> is not a function');
    });
  });

  describe('aNodeSystemErrorMessage', () => {
    it('keepsTheCodeAndTheReasonAndHidesThePath', () => {
      expect(
        maskMessage("ENOENT: no such file or directory, open 'C:\\Users\\Jo Smith\\Budget.folio'"),
      ).toBe("ENOENT: no such file or directory, open '<?>'");
      expect(
        maskMessage('EACCES: permission denied, open /Users/jo smith/Documents/Smith Family/a.csv'),
      ).toBe('EACCES: permission denied, open /<?>/a.<?>');
    });
  });

  describe('aJsonParseMessage', () => {
    it('keepsThePositionAndHidesTheQuotedText', () => {
      expect(maskMessage('Unexpected token } in JSON at position 4012')).toBe(
        'Unexpected token } in JSON at position 4012',
      );
      expect(maskMessage('Unexpected end of JSON input')).toBe('Unexpected end of JSON input');
      expect(maskMessage('Unexpected token \'}\', "{"a":1,}" is not valid JSON')).not.toContain(
        '{',
      );
    });
  });

  describe('aMessageWithLineAndColumnNumbers', () => {
    it('keepsTheNumbersAfterPositionWordsOnly', () => {
      expect(maskMessage('bad entry accounts.jsonl line 4012')).toBe('bad entry <?> line 4012');
      expect(maskMessage('invalid at line: 4 column=7 but 55 of 99')).toBe(
        'invalid at line: 4 column=7 but <?> of <?>',
      );
    });
  });

  describe('messagesThatHoldData', () => {
    const cases: readonly (readonly [string, readonly string[]])[] = [
      ['bad amount "1,234.56" for account 99-8877', ['1,234', '234.56', '99', '8877', 'amount']],
      ['Cannot parse $1,200.00 paid to Acme Bank', ['1,200', 'Acme', 'Bank', '$1']],
      ['1.234,56 € to Jo Smith', ['1.234', '234,56', 'Jo', 'Smith']],
      ['IBAN GB82WEST12345698765432 rejected', ['GB82', 'WEST', '12345698765432', 'IBAN']],
      ['bad email jo.smith@example.com', ['jo.smith', 'example', '@example']],
      ['phone +1 (555) 123-4567 invalid', ['555', '123', '4567']],
      ['date 2026-11-21 is invalid', ['2026', '11-21']],
      ['uuid 3f2b8c1e-9d4a-4e7b-8a1c-5d6e7f8a9b0c missing', ['3f2b', '9d4a', '5d6e', '8a9b0c']],
      ['José García owes 田中太郎', ['José', 'García', '田中太郎']],
      [
        'Budget 2026.folio not found in C:\\Users\\Jo Smith\\Documents',
        ['Budget', 'Jo', 'Documents'],
      ],
      ['https://bank.example.com/accounts/12345 refused', ['bank', 'example', '12345', 'accounts']],
      ["can't read \"Rent 1200\" or 'Salary 5200'", ['Rent', '1200', 'Salary', '5200']],
      ['unterminated "Rent 1200 Acme', ['Rent', '1200', 'Acme']],
      ['multi\nline\r\nSalary 5200\tAcme', ['Salary', '5200', 'Acme']],
      ['Ünïcödé Måndag 123', ['Ünïcödé', 'Måndag', '123']],
    ];
    it('hidesTheValuesInEveryMessage', () => {
      for (const [message, secrets] of cases) {
        const masked = maskMessage(message).toLowerCase();
        for (const secret of secrets) {
          expect(masked, message).not.toContain(secret.toLowerCase());
        }
      }
    });
  });

  describe('severalHiddenWordsInARow', () => {
    it('becomeOneMaskSoTheirNumberIsNotShown', () => {
      expect(maskMessage('Rent 1,200.00 Acme Bank')).toBe('<?>');
      expect(maskMessage('jo/smith/budget.csv')).toBe('<?>');
    });
  });

  describe('anInputLongerThanTheLimit', () => {
    it('isCutBeforeItIsLookedAt', () => {
      expect(maskMessage('Acme '.repeat(100_000)).length).toBeLessThan(20);
    });
  });

  describe('aMultiLineMessage', () => {
    it('becomesOneLine', () => {
      expect(maskMessage('unexpected\nend\r\nof\tinput')).toBe('unexpected end of input');
    });
  });

  describe('anEmptyMessage', () => {
    it('returnsAnEmptyString', () => {
      expect(maskMessage('')).toBe('');
    });
  });

  describe('anyText', () => {
    it('keepsOnlyVocabularyWords', () => {
      fc.assert(
        fc.property(fc.string({ unit: 'binary', maxLength: 300 }), (text) => {
          const words = maskMessage(text).match(/[\p{L}\p{M}]+/gu) ?? [];
          for (const word of words) {
            expect(LOG_VOCABULARY.has(word.toLowerCase())).toBe(true);
          }
        }),
        { numRuns: 500 },
      );
    });

    it('keepsNumbersOnlyAfterPositionWords', () => {
      const lead = `\\b(${[...POSITION_WORDS].join('|')})\\s*[:=]?\\s*\\p{N}+`;
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom(...POSITION_WORDS, 'Acme', '12', ' ', ':', '7', '3.5', 'x'), {
            maxLength: 20,
          }),
          (parts) => {
            const masked = maskMessage(parts.join(' '));
            const rest = masked.replace(new RegExp(lead, 'giu'), '$1');
            expect(rest).not.toMatch(/\p{N}/u);
          },
        ),
        { numRuns: 500 },
      );
    });
  });
});

describe('LOG_VOCABULARY', () => {
  describe('everyEntry', () => {
    it('isAPlainLowerCaseWord', () => {
      for (const word of LOG_VOCABULARY) {
        expect(word).toMatch(/^[a-z]+$/u);
      }
    });
  });

  describe('wordsThatCouldStandForAPersonABusinessOrMoney', () => {
    it('areNotInTheList', () => {
      const banned = [
        'account',
        'balance',
        'amount',
        'payment',
        'bank',
        'salary',
        'rent',
        'income',
        'tax',
        'transfer',
        'credit',
        'debit',
        'card',
        'iban',
        'will',
        'may',
        'mark',
        'grant',
        'long',
        'short',
        'key',
        'apple',
        'shell',
        'target',
        'delta',
        'chase',
        'bill',
        'jo',
        'smith',
      ];
      for (const word of banned) {
        expect(LOG_VOCABULARY.has(word)).toBe(false);
      }
    });
  });
});
