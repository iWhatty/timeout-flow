// ./raf/everyRaf.js
import { resolveDelayFnOptions, isPlainOptions } from '../resolveDelayAndFn.js';
import { attachAbort } from '../abort.js';
import { now } from '../now.js';


/**
 * Repeats a function every N milliseconds using requestAnimationFrame.
 *
 * Preferred:
 * - everyRaf(fn, duration, [options])
 *
 * Also supported (legacy):
 * - everyRaf(duration, fn, [maxTimes], [runImmediately], [options])
 *
 * Timing model:
 * - Counts down using frame deltas.
 * - Paused time does NOT count (pause freezes remaining-to-next-tick).
 * - On large frame gaps, may "catch up" by running multiple ticks in one frame,
 *   but will never exceed max.
 *
 * @param {Function|string|number} a
 * @param {Function|string|number|Object} b
 * @param {number|boolean|Object} [c] - legacy maxTimes OR legacy runImmediately OR options
 * @param {boolean|Object} [d] - legacy runImmediately OR options
 * @param {Object} [e] - legacy options
 * @returns {{
 *   pause(): void,
 *   resume(): void,
 *   cancel(): void,
 *   reset(restart?: boolean): void,
 *   readonly isRunning: boolean,
 *   readonly isPaused: boolean,
 *   readonly isFinished: boolean,
 *   readonly count: number
 * }}
 */
export function everyRaf(a, b, c, d, e) {
    const durationFirst = typeof a !== 'function';

    // ---- Normalize legacy positional args into options (without breaking legacy behavior) ----
    let legacyMax;
    let legacyRunImmediately;

    /** @type {any} */
    let optionsCandidate;

    if (durationFirst) {
        // Legacy or duration-first:
        // - everyRaf(duration, fn, options)
        // - everyRaf(duration, fn, maxTimes, runImmediately, options)
        // - everyRaf(duration, fn, maxTimes, options)
        // - everyRaf(duration, fn, runImmediately, options)  (extra leniency)
        if (isPlainOptions(c)) {
            optionsCandidate = c;
        } else if (isPlainOptions(d)) {
            optionsCandidate = d;
        } else if (isPlainOptions(e)) {
            optionsCandidate = e;
        } else {
            optionsCandidate = {};
        }

        if (typeof c === 'number') legacyMax = c;
        if (typeof d === 'boolean') legacyRunImmediately = d;

        // Lenient support: (duration, fn, true, options) => runImmediately=true
        if (legacyRunImmediately == null && typeof c === 'boolean') legacyRunImmediately = c;
    } else {
        // Preferred fn-first:
        // - everyRaf(fn, duration, options?)
        optionsCandidate = isPlainOptions(c) ? c : {};
    }

    // Parse fn + duration using shared helper (duration is REQUIRED)
    const { fn, delay, options } = resolveDelayFnOptions(a, b, optionsCandidate, undefined);

    const signal = options?.signal;

    const maxFromOptions = options?.max ?? Infinity;
    const runImmediatelyFromOptions = options?.runImmediately ?? false;

    // Legacy positional should win (to preserve prior behavior)
    const max = legacyMax != null ? legacyMax : maxFromOptions;
    const runImmediately =
        legacyRunImmediately != null ? legacyRunImmediately : runImmediatelyFromOptions;

    const intervalMs = Math.max(0, delay);

    let rafId = 0;
    let count = 0;

    // remaining time until next tick (pause-safe)
    let remainingToNext = intervalMs;

    // last frame timestamp (used for delta while running)
    let lastTs = null; // number | null

    let running = false;
    let paused = false;
    let finished = false;

    const cancelFrame = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
    };

    let cleanupAbort = () => { };

    const cleanupAbortListener = () => {
        cleanupAbort();
        cleanupAbort = () => { };
    };

    const finish = () => {
        cancelFrame();
        running = false;
        paused = false;
        finished = true;

        lastTs = null;
        remainingToNext = 0;

        cleanupAbortListener();
    };

    const cancel = () => {
        if (finished) return;
        finish();
    };

    const attachAbortListener = () => {
        cleanupAbortListener();

        // Preserve semantics: if already aborted, become terminal (and do not attach).
        if (signal?.aborted) {
            finished = true;
            remainingToNext = 0;
            return;
        }

        cleanupAbort = attachAbort(signal, cancel);
    };

    attachAbortListener();

    const canRunMore = () => count < max;

    const fire = () => {
        fn?.(count++);
        if (!canRunMore()) {
            finish();
            return false;
        }
        return running && !finished;
    };

    const tick = (ts) => {
        if (!running || finished) return;

        if (signal?.aborted) {
            finish();
            return;
        }

        if (!canRunMore()) {
            finish();
            return;
        }

        if (lastTs == null) lastTs = ts;

        const delta = ts - lastTs;
        lastTs = ts;

        // Decrement remaining time based on frame delta
        remainingToNext -= delta;

        // Catch-up loop: if we missed multiple intervals, fire multiple times.
        // Protect against infinite loops: intervalMs could be 0.
        const step = Math.max(0, intervalMs);

        if (step === 0) {
            // If interval is 0ms, treat as "once per frame"
            remainingToNext = 0;
            if (fire()) rafId = requestAnimationFrame(tick);
            return;
        }

        while (remainingToNext <= 0 && !finished) {
            const ok = fire();
            if (!ok) return;

            // carry over overshoot
            remainingToNext += step;
        }

        rafId = requestAnimationFrame(tick);
    };

    const startLoop = () => {
        if (finished) return;

        if (signal?.aborted) {
            finish();
            return;
        }

        if (!canRunMore()) {
            finish();
            return;
        }

        running = true;
        paused = false;
        lastTs = null;
        rafId = requestAnimationFrame(tick);
    };

    const pause = () => {
        if (!running || finished) return;

        cancelFrame();

        // Freeze remainingToNext based on time since lastTs
        const currentTime = now(); // ✅ fixed: no shadowing / TDZ
        if (lastTs != null) {
            const delta = currentTime - lastTs;
            remainingToNext = Math.max(0, remainingToNext - delta);
        }

        lastTs = null;
        running = false;
        paused = true;
    };

    const resume = () => {
        if (finished || running || !paused) return;
        if (signal?.aborted) return;

        if (!canRunMore()) {
            finish();
            return;
        }

        startLoop();
    };

    const reset = (restart = false) => {
        cancelFrame();

        count = 0;
        remainingToNext = intervalMs;
        lastTs = null;

        running = false;
        paused = false;
        finished = false;

        // Re-attach abort on reset (consistent with non-RAF timers)
        attachAbortListener();
        if (finished) return;

        // If max is already satisfied by definition (<=0 but not Infinity), finish.
        if (!(max > 0) && max !== Infinity) {
            finish();
            return;
        }

        if (restart) {
            // Optionally honor runImmediately on restart (matching constructor semantics)
            if (runImmediately && canRunMore()) {
                fire();
                if (finished) return;
            }
            startLoop();
        }
    };

    // Initial launch
    if (!finished) {
        if (!(max > 0) && max !== Infinity) {
            finish();
        } else {
            if (runImmediately && canRunMore()) {
                fire();
            }
            if (!finished) {
                remainingToNext = Math.max(0, intervalMs);
                startLoop();
            }
        }
    } else {
        cleanupAbortListener();
    }

    return {
        pause,
        resume,
        cancel,
        reset,
        get isRunning() {
            return running;
        },
        get isPaused() {
            return paused;
        },
        get isFinished() {
            return finished;
        },
        get count() {
            return count;
        },
    };
}