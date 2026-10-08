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
export function waitFor<T>(condition: () => T | Promise<T>, { interval, timeout, immediate, signal }?: {
    interval?: string | number | undefined;
    timeout?: string | number | undefined;
    immediate?: boolean | undefined;
    signal?: AbortSignal | undefined;
}): Promise<T>;
