// ./src/waitFor.js

import { attachAbort, abortReason } from './abort.js';
import { toDelay } from './sleep.js';


/**
 * Waits for a condition to become truthy, polling at intervals.
 *
 * Timing model:
 * - With `immediate: false` (default) the first check runs after `interval`.
 * - The next check is scheduled `interval` after the previous one finishes,
 *   so async conditions never overlap.
 * - `timeout` is measured from the call and enforced by its own timer, so it
 *   is not rounded up to the next poll. At the deadline a sync condition gets
 *   one final check (success at exactly `timeout` counts, like `>=`); an async
 *   check still pending at the deadline is abandoned and the promise rejects.
 *
 * @template T
 * @param {() => T | Promise<T>} condition - sync or async; truthy when satisfied
 * @param {Object} [options] - optional polling control
 * @param {string|number} [options.interval='250ms'] - delay between checks
 * @param {string|number} [options.timeout] - max wait time; rejects with an
 *        Error named 'TimeoutError' (message 'waitFor timed out')
 * @param {boolean} [options.immediate=false] - If true, evaluate condition immediately
 * @param {AbortSignal} [options.signal] - rejects with `signal.reason` on abort
 * @returns {Promise<T>} resolves with the condition's truthy value
 */
export function waitFor(condition, { interval = '250ms', timeout, immediate = false, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const intervalMs = toDelay(interval);
    const timeoutMs = timeout != null ? toDelay(timeout) : null;

    let done = false;
    let pending = false;
    let poller = 0;
    let deadline = 0;

    const finish = (settle, value) => {
      if (done) return;
      done = true;
      clearTimeout(poller);
      clearTimeout(deadline);
      cleanupAbort();
      settle(value);
    };

    const cleanupAbort = attachAbort(signal, () => finish(reject, abortReason(signal)));

    const check = async () => {
      let value;
      pending = true;
      try {
        value = await condition();
      } catch (err) {
        finish(reject, err);
        return;
      } finally {
        pending = false;
      }
      if (done) return;
      if (value) finish(resolve, value);
      else poller = setTimeout(check, intervalMs);
    };

    if (immediate) check();
    else poller = setTimeout(check, intervalMs);

    if (timeoutMs != null) {
      deadline = setTimeout(() => {
        if (!pending) {
          // Final check at the deadline (sync results only).
          let value;
          try {
            value = condition();
          } catch (err) {
            finish(reject, err);
            return;
          }
          if (value && typeof value.then !== 'function') {
            finish(resolve, value);
            return;
          }
        }
        const err = new Error('waitFor timed out');
        err.name = 'TimeoutError';
        finish(reject, err);
      }, timeoutMs);
    }
  });
}
