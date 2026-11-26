// ------------------------------
// serial-queue.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/** Runs jobs that share a key one after another, and jobs with different keys side by side. */
export interface SerialQueue {
  /**
   * Run a job after every earlier job with the same key has finished, whether it succeeded or not.
   * @param key - What the jobs contend for, such as a folder.
   * @param job - The work.
   * @returns What the job returns, or its failure.
   */
  run<Value>(key: string, job: () => Promise<Value>): Promise<Value>;
}

/**
 * Create a queue. It keeps nothing for a key once that key's jobs are done.
 * @returns The queue.
 */
export function createSerialQueue(): SerialQueue {
  // Each key holds a gate that opens when the latest job for it ends; gates never reject.
  const gates = new Map<string, Promise<void>>();
  return {
    run: async (key, job) => {
      const previous = gates.get(key);
      let open: () => void = () => undefined;
      const mine = new Promise<void>((resolve) => {
        open = resolve;
      });
      gates.set(key, mine);
      try {
        await previous;
        return await job();
      } finally {
        open();
        if (gates.get(key) === mine) {
          gates.delete(key);
        }
      }
    },
  };
}
