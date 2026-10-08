// ./src/retry.js
import { parseDuration } from './parseDuration.js';
import { abortReason } from './abort.js';
import { now as defaultNow } from './now.js';
import { sleep as defaultSleep, toDelay } from './sleep.js';

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
 * @param {boolean|number|'full'|'equal'|'decorrelated'} [options.jitter=false] - jitter strategy.
 *        A number j in [0, 1] applies proportional ±j jitter:
 *        delay * (1 + (random()*2 - 1) * j), after the maxDelay cap and then
 *        re-capped by maxDelay, clamped to >= 0 and rounded. Other numbers
 *        (or NaN) reject with a RangeError before any attempt.
 *        `delayFirst` is never jittered.
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
export async function retry(
  fn,
  {
    attempts = 3,
    delay = '500ms',
    backoff = false,
    factor = 2,
    maxDelay,
    jitter = false,
    delayFirst = false,
    timeout,
    signal,
    isSuccess,
    shouldRetry,
    onAttempt,
    onRetry,
    sleep = defaultSleep,
    now = defaultNow,
    random = Math.random,
  } = {}
) {
  if (typeof fn !== 'function') throw new TypeError('retry: fn must be a function');

  const totalAttempts = attempts === Infinity ? Infinity : Math.max(1, attempts | 0);

  const throwIfAborted = () => {
    if (signal?.aborted) throw abortReason(signal);
  };
  throwIfAborted();

  if (typeof jitter === 'number' && !(jitter >= 0 && jitter <= 1)) {
    throw new RangeError(`retry: numeric jitter must be within [0, 1], got: ${jitter}`);
  }

  const baseDelay = parseDuration(delay);
  const maxDelayMs = maxDelay != null ? parseDuration(maxDelay) : Infinity;
  const deadline = timeout != null ? parseDuration(timeout) : Infinity;
  const mode = backoff === true ? 'exponential' : backoff || 'fixed';
  const start = now();
  const elapsed = () => now() - start;

  const wait = async (ms) => {
    await sleep(ms, { signal });
    throwIfAborted(); // custom sleeps may ignore the signal
  };

  if (delayFirst) await wait(toDelay(delayFirst === true ? baseDelay : delayFirst));

  // decorrelated jitter needs to remember prior sleep
  let prevSleep = Math.min(baseDelay, maxDelayMs);

  for (let attempt = 0; ; attempt++) {
    throwIfAborted();
    if (onAttempt) await onAttempt(attempt, elapsed());

    let failure;
    try {
      const result = await fn(attempt);
      if (!isSuccess || (await isSuccess(result, attempt))) return result;
      failure = new RetryError(result, attempt + 1);
    } catch (err) {
      failure = err;
    }

    if (attempt + 1 >= totalAttempts) throw failure;
    if (shouldRetry && !(await shouldRetry(failure, attempt))) throw failure;

    const growth =
      mode === 'exponential' ? Math.pow(factor, attempt) :
        mode === 'linear' ? attempt + 1 :
          1;

    const ms = toDelay(Math.round(computeSleep({
      expDelay: baseDelay * growth,
      baseDelay,
      maxDelayMs,
      jitter,
      random,
      prevSleep,
    })));
    prevSleep = ms;

    // Don't begin a wait whose next attempt would start past the deadline.
    if (elapsed() + ms > deadline) throw failure;

    if (onRetry) await onRetry(failure, attempt, ms);

    await wait(ms);
  }
}

/**
 * Rejection used when the final attempt resolved with a result that
 * `isSuccess` rejected. Check with `err.name === 'RetryError'`.
 */
class RetryError extends Error {
  constructor(result, attempts) {
    super(`retry: unsuccessful result after ${attempts} attempt(s)`);
    this.name = 'RetryError';
    this.result = result;
    this.attempts = attempts;
  }
}

/**
 * Compute retry sleep with optional backoff clamp + jitter.
 *
 * Jitter strategies:
 * - false: no jitter
 * - 'full':     random(0, cap)
 * - 'equal':    cap/2 + random(0, cap/2)
 * - 'decorrelated': random(baseDelay, prevSleep*3) (clamped)
 * - number j:   cap * (1 ± j), re-capped by maxDelay, >= 0
 */
function computeSleep({ expDelay, baseDelay, maxDelayMs, jitter, random, prevSleep }) {
  const cap = Math.min(expDelay, maxDelayMs);

  if (!jitter) return cap;

  if (typeof jitter === 'number') {
    const spread = randBetween(-1, 1, random) * jitter;
    return Math.min(maxDelayMs, Math.max(0, cap * (1 + spread)));
  }

  const mode = jitter === true ? 'full' : jitter;

  if (mode === 'full') {
    return Math.min(maxDelayMs, randBetween(0, cap, random));
  }

  if (mode === 'equal') {
    const half = cap / 2;
    return Math.min(maxDelayMs, half + randBetween(0, half, random));
  }

  if (mode === 'decorrelated') {
    const next = randBetween(baseDelay, prevSleep * 3, random);
    return Math.min(maxDelayMs, next);
  }

  // Unknown mode -> treat as no jitter (safe fallback)
  return cap;
}

function randBetween(min, max, random) {
  const r = random();
  const t = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
  return min + (max - min) * t;
}
