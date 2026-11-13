// ------------------------------
// store.test.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

import { describe, expect, it } from 'vitest';

import { createStore } from './store.js';

describe('createStore', () => {
  describe('defaultState', () => {
    it('returnsTheInitialState', () => {
      const initial = { count: 0 };
      expect(createStore(initial).getState()).toBe(initial);
    });
  });

  describe('setStateWithANewObject', () => {
    it('updatesTheStateAndNotifiesListeners', () => {
      const store = createStore({ count: 0 });
      let calls = 0;
      store.subscribe(() => void (calls += 1));
      store.setState((state) => ({ count: state.count + 1 }));
      expect(store.getState()).toEqual({ count: 1 });
      expect(calls).toBe(1);
    });
  });

  describe('setStateWithTheSameObject', () => {
    it('doesNotNotifyListeners', () => {
      const store = createStore({ count: 0 });
      let calls = 0;
      store.subscribe(() => void (calls += 1));
      store.setState((state) => state);
      expect(calls).toBe(0);
    });
  });

  describe('afterUnsubscribing', () => {
    it('stopsNotifyingThatListener', () => {
      const store = createStore(1);
      let calls = 0;
      const stop = store.subscribe(() => void (calls += 1));
      stop();
      store.setState((state) => state + 1);
      expect(calls).toBe(0);
    });
  });
});
