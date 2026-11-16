// ------------------------------
// store.ts
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** A small observable holder of immutable state, shaped for React's `useSyncExternalStore`. */
export interface Store<State> {
  /** The current state. The same object is returned until the state changes. */
  readonly getState: () => State;
  /** Replace the state with the result of `update`; listeners run only when it is a new object. */
  readonly setState: (update: (current: State) => State) => void;
  /** Call `listener` after every change; returns a function that stops listening. */
  readonly subscribe: (listener: () => void) => () => void;
}

/**
 * Create a store (AD-14): UI state lives in the core, and components read it through
 * `useSyncExternalStore` so they stay thin.
 * @param initial - The starting state.
 * @returns The store.
 */
export function createStore<State>(initial: State): Store<State> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => current,
    setState: (update) => {
      const next = update(current);
      if (Object.is(next, current)) {
        return;
      }
      current = next;
      for (const listener of [...listeners]) {
        listener();
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
