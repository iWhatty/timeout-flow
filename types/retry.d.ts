/**
 * Retries a (possibly async) function with delays between attempts.
 *
 * Attempt numbers are 0-based everywhere (`fn`, hooks, predicates).
 *
 * Outcome:
 * - Resolves with the first successful result.
 * - When retries stop (attempts exhausted, `timeout` reached, or
 *   `shouldRetry` returned false) it rejects with the last failure:
 *   the last thrown error as-is, or, when the last attempt resolved with a
 *   result rejected by `isSuccess`, a `RetryError` (`name: 'RetryError'`)
 *   carrying `.result` and `.attempts`.
 * - On abort it rejects with `signal.reason` (an AbortError by default).
 *
 * @template T
 * @param {(attempt: number) => T | Promise<T>} fn - sync or async function
 * @param {Object} [options]
 * @param {number} [options.attempts=3] - total attempts including the first (`Infinity` allowed)
 * @param {string|number} [options.delay='500ms'] - base delay between attempts
 * @param {boolean|'fixed'|'linear'|'exponential'} [options.backoff=false]
 *        Delay growth per retry n (0-based): fixed (false) = delay,
 *        linear = delay*(n+1), exponential (true) = delay*factor^n.
 * @param {number} [options.factor=2] - exponential multiplier
 * @param {string|number} [options.maxDelay] - cap for each computed delay
 * @param {boolean|'full'|'equal'|'decorrelated'} [options.jitter=false] - jitter strategy
 * @param {boolean|string|number} [options.delayFirst=false]
 *        Wait before the first attempt (`true` = `delay`, or an explicit duration).
 * @param {string|number} [options.timeout] - overall deadline measured from the call.
 *        A retry is skipped when its wait would end past the deadline; the first
 *        attempt always runs and an in-flight attempt is never interrupted.
 * @param {AbortSignal} [options.signal] - cancels waiting and further attempts
 * @param {(result: T, attempt: number) => boolean | Promise<boolean>} [options.isSuccess]
 *        Treat a resolved result as a failure (and retry) when this returns false.
 * @param {(err: any, attempt: number) => boolean | Promise<boolean>} [options.shouldRetry]
 *        Return false to stop retrying after a failure.
 * @param {(attempt: number, elapsedMs: number) => void | Promise<void>} [options.onAttempt]
 *        Called before every attempt.
 * @param {(err: any, attempt: number, delayMs: number) => void | Promise<void>} [options.onRetry]
 *        Called after deciding to retry and before waiting.
 * @param {(ms: number, options: { signal?: AbortSignal }) => Promise<void>} [options.sleep]
 *        Injectable sleep (e.g. for fake-timer tests).
 * @param {() => number} [options.now] - injectable clock used for `timeout`
 * @param {() => number} [options.random=Math.random] - injectable RNG for tests
 * @returns {Promise<T>}
 */
export function retry<T>(fn: (attempt: number) => T | Promise<T>, { attempts, delay, backoff, factor, maxDelay, jitter, delayFirst, timeout, signal, isSuccess, shouldRetry, onAttempt, onRetry, sleep, now, random, }?: {
    attempts?: number | undefined;
    delay?: string | number | undefined;
    backoff?: boolean | "fixed" | "exponential" | "linear" | undefined;
    factor?: number | undefined;
    maxDelay?: string | number | undefined;
    jitter?: boolean | "full" | "equal" | "decorrelated" | undefined;
    delayFirst?: string | number | boolean | undefined;
    timeout?: string | number | undefined;
    signal?: AbortSignal | undefined;
    isSuccess?: ((result: T, attempt: number) => boolean | Promise<boolean>) | undefined;
    shouldRetry?: ((err: any, attempt: number) => boolean | Promise<boolean>) | undefined;
    onAttempt?: ((attempt: number, elapsedMs: number) => void | Promise<void>) | undefined;
    onRetry?: ((err: any, attempt: number, delayMs: number) => void | Promise<void>) | undefined;
    sleep?: ((ms: number, options: {
        signal?: AbortSignal;
    }) => Promise<void>) | undefined;
    now?: (() => number) | undefined;
    random?: (() => number) | undefined;
}): Promise<T>;
