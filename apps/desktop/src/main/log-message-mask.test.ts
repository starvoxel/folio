// ------------------------------
// log-message-mask.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-21
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { maskMessage, maskMessageWithReport } from './log-message-mask.js';
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

/**
 * Messages recorded from real Node and V8 errors (generated with a small script that provokes each
 * one, then pasted here with file paths made generic), and the masked text that was reviewed for
 * each. A change to the masker or the word list that changes any line shows up here as a diff to
 * review: a hidden word that should be visible is a word to add to the list, and a visible word
 * that could be data is a bug.
 */
const RECORDED_MESSAGES: readonly (readonly [string, string])[] = [
  [
    "Cannot read properties of null (reading 'foo')",
    "Cannot read properties of null (reading '<?>')",
  ],
  [
    "Cannot read properties of undefined (reading 'foo')",
    "Cannot read properties of undefined (reading '<?>')",
  ],
  [
    "Cannot read properties of undefined (reading 'b')",
    "Cannot read properties of undefined (reading '<?>')",
  ],
  ['o.fn is not a function', '<?> is not a function'],
  ['x is not a function', '<?> is not a function'],
  ['nope is not defined', '<?> is not defined'],
  ['Assignment to constant variable.', 'Assignment to constant variable.'],
  [
    "Cannot read properties of undefined (reading 'z')",
    "Cannot read properties of undefined (reading '<?>')",
  ],
  [
    'Expected double-quoted property name in JSON at position 7 (line 1 column 8)',
    'Expected double-quoted property name in JSON at position 7 (line 1 column 8)',
  ],
  ['Unexpected end of JSON input', 'Unexpected end of JSON input'],
  [
    "Expected property name or '}' in JSON at position 1 (line 1 column 2)",
    "Expected property name or '<?>' in JSON at position 1 (line 1 column 2)",
  ],
  [
    'Unexpected token \'a\', "abc" is not valid JSON',
    'Unexpected token \'<?>\', "<?>" is not valid JSON',
  ],
  [
    "Expected ',' or ']' after array element in JSON at position 4 (line 1 column 5)",
    "Expected '<?>' or '<?>' after array element in JSON at position 4 (line 1 column 5)",
  ],
  ['Invalid array length', 'Invalid array length'],
  ['Invalid count value: -1', 'Invalid count value: <?>'],
  [
    'toFixed() digits argument must be between 0 and 100',
    '<?>() digits argument must be between <?> and <?>',
  ],
  ['Maximum call stack size exceeded', 'Maximum call stack size exceeded'],
  ['URI malformed', 'URI malformed'],
  ['Invalid URL', 'Invalid URL'],
  ['Cannot convert 1.5 to a BigInt', 'Cannot convert <?> to a <?>'],
  ['Cannot convert a Symbol value to a string', 'Cannot convert a Symbol value to a string'],
  ['5 is not iterable', '<?> is not iterable'],
  ['null is not iterable', 'null is not iterable'],
  [
    "Cannot destructure property 'a' of 'null' as it is null.",
    "Cannot destructure property '<?>' of '<?>' as it is null.",
  ],
  ['Currency code is required with currency style.', '<?> code is required with <?> style.'],
  [
    'Cannot define property a, object is not extensible',
    'Cannot define property a, object is not extensible',
  ],
  [
    "Cannot assign to read only property 'a' of object '#<Object>'",
    "Cannot assign to read only property '<?>' of object '<?>'",
  ],
  ['Invalid time value', 'Invalid time value'],
  ['() => {} could not be cloned.', '() => {} could not be cloned.'],
  [
    'The first argument must be of type string or an instance of Buffer, ArrayBuffer, or Array or an Array-like Object. Received an instance of Object',
    'The first argument must be of type string or an instance of Buffer, <?>, or Array or an Array-like Object. Received an instance of Object',
  ],
  [
    "ENOENT: no such file or directory, open '/tmp/x/missing.csv'",
    "ENOENT: no such file or directory, open '<?>'",
  ],
  [
    'EISDIR: illegal operation on a directory, read',
    'EISDIR: illegal operation on a directory, read',
  ],
  [
    "ENOENT: no such file or directory, open '/tmp/x/a/b.txt'",
    "ENOENT: no such file or directory, open '<?>'",
  ],
  [
    "ENOENT: no such file or directory, open '/tmp/x/no/x'",
    "ENOENT: no such file or directory, open '<?>'",
  ],
  ["Cannot find module 'fflate'", "Cannot find module '<?>'"],
  [
    'The encoded data was not valid for encoding utf-8',
    'The encoded data was not valid for encoding utf<?>',
  ],
  ['Array buffer allocation failed', 'Array buffer allocation failed'],
  ['Invalid array buffer length', 'Invalid array buffer length'],
  ['Reduce of empty array with no initial value', 'Reduce of empty array with no initial value'],
  [
    'number 5 is not iterable (cannot read property Symbol(Symbol.iterator))',
    'number <?> is not iterable (cannot read property Symbol(Symbol.iterator))',
  ],
  ['Iterator value 1 is not an entry object', 'Iterator value <?> is not an entry object'],
  ['Reflect.ownKeys called on non-object', '<?> called on non-object'],
  [
    'Cannot create proxy with a non-object as target or handler',
    'Cannot create proxy with a non-object as <?> or handler',
  ],
  [
    'Method Promise.prototype.then called on incompatible receiver 1',
    'Method Promise.prototype.then called on incompatible receiver <?>',
  ],
  ['Symbol() could not be cloned.', 'Symbol() could not be cloned.'],
  ["can't parse the file", "can't <?> the file"],
  ['value -5 is not valid', 'value <?> is not valid'],
];

describe('maskMessage', () => {
  describe('recordedNodeAndV8Messages', () => {
    it('matchesTheReviewedOutputForEveryMessage', () => {
      for (const [message, reviewed] of RECORDED_MESSAGES) {
        expect(maskMessage(message), message).toBe(reviewed);
      }
    });

    it('keepsAtLeastEightyPercentOfTheWords', () => {
      let total = 0;
      let kept = 0;
      for (const [message, reviewed] of RECORDED_MESSAGES) {
        total += message.match(/[\p{L}]+/gu)?.length ?? 0;
        kept += reviewed.match(/[\p{L}]+/gu)?.length ?? 0;
      }
      expect(kept / total).toBeGreaterThanOrEqual(0.8);
    });
  });
});

describe('maskMessageWithReport', () => {
  describe('aMessageWithWordsOutsideTheVocabulary', () => {
    it('reportsEachHiddenWordOnceInLowerCase', () => {
      const report = maskMessageWithReport('Cannot parse Budget budget and Budget.csv');
      expect(report.hiddenWords).toEqual(['parse', 'budget', 'csv']);
      expect(report.masked).toBe(maskMessage('Cannot parse Budget budget and Budget.csv'));
    });
  });

  describe('wordsInsideQuotedText', () => {
    it('areNotReported', () => {
      expect(maskMessageWithReport('bad "Acme Rent" value').hiddenWords).toEqual([]);
    });
  });

  describe('aMessageWithOnlyVocabularyWords', () => {
    it('reportsNothing', () => {
      expect(maskMessageWithReport('Unexpected end of JSON input').hiddenWords).toEqual([]);
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
