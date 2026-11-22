// ------------------------------
// log-destinations.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-22
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createLogDestinations } from './log-destinations.js';

/**
 * Make destinations that record where each line went.
 * @param packaged - Whether the build is packaged.
 * @param unredacted - Whether the unredacted output was asked for.
 * @returns The destinations, the record of lines per destination and the files that were opened.
 */
function setup(
  packaged: boolean,
  unredacted: boolean,
): {
  destinations: ReturnType<typeof createLogDestinations>;
  written: Record<string, string[]>;
  opened: string[];
} {
  const written: Record<string, string[]> = {
    stderr: [],
    'folio.log': [],
    'folio-unredacted.log': [],
  };
  const opened: string[] = [];
  const destinations = createLogDestinations({
    packaged,
    unredacted,
    stderr: (line) => void written['stderr']?.push(line),
    file: (fileName) => {
      opened.push(fileName);
      return (line) => void written[fileName]?.push(line);
    },
  });
  return { destinations, written, opened };
}

describe('createLogDestinations', () => {
  describe('aPackagedBuild', () => {
    it('sendsTheNormalLineToStderrAndTheLogFileOnly', () => {
      const { destinations, written, opened } = setup(true, false);
      destinations.write('normal');
      expect(written).toEqual({
        stderr: ['normal'],
        'folio.log': ['normal'],
        'folio-unredacted.log': [],
      });
      expect(destinations.writeUnredacted).toBeUndefined();
      expect(opened).toEqual(['folio.log']);
    });
  });

  describe('aPackagedBuildThatAsksForTheUnredactedOutput', () => {
    it('getsNoUnredactedWriterAndNoUnredactedFile', () => {
      const { destinations, opened } = setup(true, true);
      expect(destinations.writeUnredacted).toBeUndefined();
      destinations.write('normal');
      expect(opened).toEqual(['folio.log']);
    });
  });

  describe('anUnpackagedRunWithoutTheSwitch', () => {
    it('sendsTheNormalLineToStderrAndTheLogFile', () => {
      const { destinations, written } = setup(false, false);
      destinations.write('normal');
      expect(written['stderr']).toEqual(['normal']);
      expect(written['folio.log']).toEqual(['normal']);
      expect(destinations.writeUnredacted).toBeUndefined();
    });
  });

  describe('anUnpackagedRunWithTheSwitch', () => {
    it('sendsTheNormalLineToStderrAndTheLogFileAndTheUnredactedLineToStderrAndItsOwnFile', () => {
      const { destinations, written } = setup(false, true);
      destinations.write('normal');
      destinations.writeUnredacted?.('raw');
      expect(written['folio.log']).toEqual(['normal']);
      expect(written['folio-unredacted.log']).toEqual(['raw']);
      expect(written['stderr']).toEqual(['normal', 'raw']);
    });

    it('opensTheUnredactedFileOnlyWhenItIsNeeded', () => {
      const { opened } = setup(false, false);
      expect(opened).toEqual(['folio.log']);
    });
  });

  describe('aWriterThatThrows', () => {
    it('stillLetsTheOtherDestinationsWrite', () => {
      const lines: string[] = [];
      const destinations = createLogDestinations({
        packaged: true,
        unredacted: false,
        stderr: () => {
          throw new Error('stderr closed');
        },
        file: () => (line) => void lines.push(line),
      });
      expect(() => {
        destinations.write('normal');
      }).not.toThrow();
      expect(lines).toEqual(['normal']);
    });
  });
});
