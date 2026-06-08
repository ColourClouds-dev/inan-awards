'use client';

import { useCallback } from 'react';

const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * Returns a wrapper that runs an async function with a hard timeout.
 * If the function doesn't resolve within `timeoutMs`, the returned promise
 * rejects with a TimeoutError so the caller can show a "check your connection"
 * message instead of freezing forever.
 *
 * Usage:
 *   const withTimeout = useWithTimeout(10_000);
 *   await withTimeout(() => fetchData());
 */
export function useWithTimeout(timeoutMs = DEFAULT_TIMEOUT_MS) {
  const withTimeout = useCallback(
    <T>(fn: () => Promise<T>): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new TimeoutError('Request timed out. Check your connection and try again.'));
        }, timeoutMs);

        fn()
          .then(result => {
            clearTimeout(timer);
            resolve(result);
          })
          .catch(err => {
            clearTimeout(timer);
            reject(err);
          });
      });
    },
    [timeoutMs]
  );

  return withTimeout;
}

export class TimeoutError extends Error {
  readonly isTimeout = true;
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
