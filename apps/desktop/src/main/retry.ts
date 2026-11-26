// ------------------------------
// retry.ts
//
// Author: Starvoxel AI Agent - 2026-11-26
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * The error codes that mean "something else briefly has the file", which Windows reports when
 * antivirus or a sync client holds a file while it is replaced.
 */
export const TRANSIENT_FILE_ERRORS: readonly string[] = ['EPERM', 'EBUSY', 'EACCES'];

/** Waits between retries, in milliseconds; the number of entries is the number of retries. */
export const RENAME_RETRY_DELAYS_MS: readonly number[] = [25, 50, 100, 200, 400];

/**
 * Run an operation again after a short wait when it fails with one of a few error codes. Any
 * other failure, and the last failure once the waits run out, is thrown as it is.
 * @param work - The operation.
 * @param codes - The error codes worth retrying.
 * @param delaysMs - The waits between attempts.
 * @param sleep - Waits for a number of milliseconds.
 * @returns What the operation returned.
 */
export async function retryOnCodes<Value>(
  work: () => Promise<Value>,
  codes: readonly string[],
  delaysMs: readonly number[],
  sleep: (ms: number) => Promise<void>,
): Promise<Value> {
  for (const delay of delaysMs) {
    try {
      return await work();
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      if (typeof code !== 'string' || !codes.includes(code)) {
        throw error;
      }
      await sleep(delay);
    }
  }
  return work();
}
