// ------------------------------
// log-stack.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-16
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { MAX_STACK_FRAMES, scrubFrame, scrubPath, scrubStack } from './log-stack.js';

const WINDOWS_APP = 'C:\\Program Files\\Folio\\resources\\app.asar';
const MAC_APP = '/Users/jo smith/Applications/Folio.app/Contents/Resources/app.asar';

describe('scrubPath', () => {
  describe('aWindowsPathBelowTheAppFolder', () => {
    it('keepsTheFoldersBelowTheAppAsAppRelative', () => {
      expect(scrubPath(`${WINDOWS_APP}\\dist\\main.cjs`, WINDOWS_APP)).toBe('<app>/dist/main.cjs');
    });
  });

  describe('aWindowsPathWithAnotherDriveLetterCase', () => {
    it('stillMatchesTheAppFolder', () => {
      expect(
        scrubPath('c:\\program files\\folio\\resources\\app.asar\\main.cjs', WINDOWS_APP),
      ).toBe('<app>/main.cjs');
    });
  });

  describe('aMacPathBelowTheAppFolder', () => {
    it('dropsTheUserNameInTheInstallFolder', () => {
      const result = scrubPath(`${MAC_APP}/main.cjs`, MAC_APP);
      expect(result).toBe('<app>/main.cjs');
      expect(result).not.toContain('smith');
    });
  });

  describe('aPathBelowTheHomeFolder', () => {
    it('keepsOnlyTheFileName', () => {
      expect(scrubPath('/Users/jo smith/Documents/Smith Family/helper.js', MAC_APP)).toBe(
        'helper.js',
      );
      expect(
        scrubPath('C:\\Users\\Jo Smith\\AppData\\Local\\Temp\\x\\helper.js', WINDOWS_APP),
      ).toBe('helper.js');
    });
  });

  describe('aWindowsUncPath', () => {
    it('keepsOnlyTheFileName', () => {
      expect(scrubPath('\\\\fileserver\\home\\jo\\helper.js', WINDOWS_APP)).toBe('helper.js');
    });
  });

  describe('aFileUrlBelowTheAppFolder', () => {
    it('isDecodedAndMadeAppRelative', () => {
      expect(
        scrubPath('file:///C:/Program%20Files/Folio/resources/app.asar/dist/main.cjs', WINDOWS_APP),
      ).toBe('<app>/dist/main.cjs');
      expect(
        scrubPath(
          'file:///Users/jo%20smith/Applications/Folio.app/Contents/Resources/app.asar/main.cjs',
          MAC_APP,
        ),
      ).toBe('<app>/main.cjs');
    });
  });

  describe('aFileUrlOutsideTheAppFolder', () => {
    it('keepsOnlyTheFileName', () => {
      expect(scrubPath('file:///C:/Users/Jo%20Smith/Desktop/x.js', WINDOWS_APP)).toBe('x.js');
      expect(scrubPath('file:///Users/jo%20smith/tmp/%E0%A4%A.js', MAC_APP)).toBe('%E0%A4%A.js');
    });
  });

  describe('aFolderThatOnlySharesTheAppFolderPrefix', () => {
    it('isNotTreatedAsBelowTheApp', () => {
      expect(scrubPath(`${WINDOWS_APP}-old\\secret folder\\a.js`, WINDOWS_APP)).toBe('a.js');
    });
  });

  describe('noAppFolder', () => {
    it('keepsOnlyTheFileName', () => {
      expect(scrubPath('/opt/folio/dist/main.cjs', undefined)).toBe('main.cjs');
    });
  });

  describe('aNodeInternalPath', () => {
    it('isKeptAsItIs', () => {
      expect(scrubPath('node:internal/process/task_queues', MAC_APP)).toBe(
        'node:internal/process/task_queues',
      );
      expect(scrubPath('<anonymous>', MAC_APP)).toBe('<anonymous>');
    });
  });

  describe('aPathWithNoFileName', () => {
    it('returnsAnUnknownMarker', () => {
      expect(scrubPath('/Users/jo/', MAC_APP)).toBe('<unknown>');
    });
  });
});

describe('scrubFrame', () => {
  describe('aFrameWithAFunctionName', () => {
    it('keepsNameFileLineAndColumn', () => {
      expect(scrubFrame(`    at openFile (${WINDOWS_APP}\\main.cjs:120:5)`, WINDOWS_APP)).toBe(
        'at openFile (<app>/main.cjs:120:5)',
      );
    });
  });

  describe('aFrameWithNoFunctionName', () => {
    it('keepsTheLocationOnly', () => {
      expect(scrubFrame('    at /Users/jo smith/x/y.js:3:9', MAC_APP)).toBe('at y.js:3:9');
    });
  });

  describe('anAsyncFrame', () => {
    it('keepsTheAsyncMarker', () => {
      expect(scrubFrame('    at async Promise.all (index 0)', MAC_APP)).toBe(
        'at async Promise.all (index 0)',
      );
      expect(scrubFrame('    at async /Users/jo/x.js:1:2', MAC_APP)).toBe('at async (x.js:1:2)');
    });
  });

  describe('aWindowsPathWithParenthesesInTheFolderName', () => {
    it('stillFindsTheFileName', () => {
      expect(scrubFrame('    at C:\\Program Files (x86)\\Other\\z.js:7:1', WINDOWS_APP)).toBe(
        'at z.js:7:1',
      );
      expect(scrubFrame('    at run (C:\\Program Files (x86)\\Other\\z.js:7:1)', WINDOWS_APP)).toBe(
        'at run (z.js:7:1)',
      );
    });
  });

  describe('anEvalFrame', () => {
    it('dropsTheEvalOrigin', () => {
      expect(
        scrubFrame('    at eval (eval at run (/Users/jo/x.js:1:2), <anonymous>:3:4)', MAC_APP),
      ).toBe('at eval (<eval>)');
    });
  });

  describe('aFunctionNameThatHoldsAPathOrAQuote', () => {
    it('dropsTheName', () => {
      expect(scrubFrame('    at Object./Users/jo/x [as "a b"] (x.js:1:2)', MAC_APP)).toBe(
        'at x.js:1:2',
      );
    });
  });

  describe('aMessageLine', () => {
    it('returnsNothing', () => {
      expect(scrubFrame('TypeError: bad value "4 Elm Street"', MAC_APP)).toBeUndefined();
      expect(scrubFrame('    not at the start', MAC_APP)).toBeUndefined();
    });
  });

  describe('aVeryLongFrame', () => {
    it('isClipped', () => {
      expect(scrubFrame(`    at ${'a'.repeat(500)}.js:1:1`, MAC_APP)?.length).toBeLessThan(210);
    });
  });
});

describe('scrubStack', () => {
  describe('aStackWhoseMessageSpansSeveralLines', () => {
    it('dropsTheWholeMessageAndKeepsTheFrames', () => {
      const stack = [
        'SyntaxError: Unexpected token in "Rent, 1200.00"',
        'second line with an account number 12-3456',
        `    at parse (${MAC_APP}/main.cjs:10:2)`,
        `    at async load (${MAC_APP}/main.cjs:20:4)`,
      ].join('\n');
      expect(scrubStack(stack, MAC_APP)).toEqual({
        frames: ['at parse (<app>/main.cjs:10:2)', 'at async load (<app>/main.cjs:20:4)'],
        truncated: false,
      });
    });
  });

  describe('moreFramesThanTheLimit', () => {
    it('keepsTheFirstFramesAndMarksTheCut', () => {
      const stack = Array.from(
        { length: 50 },
        (_, index) => `    at f${index} (a.js:${index}:1)`,
      ).join('\n');
      const result = scrubStack(stack, undefined);
      expect(result.frames).toHaveLength(MAX_STACK_FRAMES);
      expect(result.frames[0]).toBe('at f0 (a.js:0:1)');
      expect(result.truncated).toBe(true);
    });
  });

  describe('exactlyTheLimit', () => {
    it('isNotMarkedAsCut', () => {
      const stack = Array.from({ length: MAX_STACK_FRAMES }, () => '    at f (a.js:1:1)').join(
        '\n',
      );
      expect(scrubStack(stack, undefined).truncated).toBe(false);
    });
  });

  describe('anEmptyStack', () => {
    it('returnsNoFrames', () => {
      expect(scrubStack('', undefined)).toEqual({ frames: [], truncated: false });
    });
  });
});
