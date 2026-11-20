// ------------------------------
// error-handlers.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-19
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { installErrorHandlers, type ErrorSource } from './error-handlers.js';
import type { Logger } from './logger.js';

/**
 * Install the handlers on a fake event source.
 * @param showError - The error box.
 * @returns The fake source's listeners and what was logged.
 */
function setup(showError: (title: string, content: string) => void): {
  emit: (event: 'uncaughtException' | 'unhandledRejection', value: unknown) => void;
  logged: { message: string; error: unknown }[];
} {
  const listeners = new Map<string, (value: unknown) => void>();
  const logged: { message: string; error: unknown }[] = [];
  const source: ErrorSource = {
    on: (event: string, listener: (value: unknown) => void) => {
      listeners.set(event, listener);
    },
  };
  const noop = (): void => undefined;
  const logger: Logger = {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    logError: (message, error) => void logged.push({ message, error }),
  };
  installErrorHandlers({ logger, showError, source });
  return {
    emit: (event, value) => {
      listeners.get(event)?.(value);
    },
    logged,
  };
}

describe('installErrorHandlers', () => {
  describe('anUncaughtException', () => {
    it('logsTheErrorAndShowsOneFixedTextBox', () => {
      const boxes: string[][] = [];
      const { emit, logged } = setup((title, content) => void boxes.push([title, content]));
      const error = new Error('balance 5000');
      emit('uncaughtException', error);
      expect(logged).toEqual([{ message: 'uncaught exception', error }]);
      expect(boxes).toHaveLength(1);
      expect(boxes[0]?.join(' ')).not.toContain('5000');
    });
  });

  describe('anUnhandledRejection', () => {
    it('logsTheReasonWhateverItIs', () => {
      const { emit, logged } = setup(() => undefined);
      emit('unhandledRejection', 'a string reason');
      expect(logged).toEqual([{ message: 'unhandled rejection', error: 'a string reason' }]);
    });
  });

  describe('severalErrorsInARow', () => {
    it('logsEachButShowsTheBoxOnlyOnce', () => {
      let boxes = 0;
      const { emit, logged } = setup(() => void (boxes += 1));
      emit('uncaughtException', new Error('a'));
      emit('unhandledRejection', new Error('b'));
      emit('uncaughtException', new Error('c'));
      expect(logged).toHaveLength(3);
      expect(boxes).toBe(1);
    });
  });

  describe('anErrorBoxThatThrows', () => {
    it('stillLogsAndDoesNotRaiseAnotherError', () => {
      const { emit, logged } = setup(() => {
        throw new Error('no display');
      });
      expect(() => {
        emit('uncaughtException', new Error('a'));
      }).not.toThrow();
      expect(logged).toHaveLength(1);
    });
  });
});
