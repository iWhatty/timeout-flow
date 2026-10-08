/**
 * Normalizes a duration to a setTimeout-safe delay in ms.
 * - Strings are parsed ("500ms", "1s", "1.5m", "1h"); invalid strings throw.
 * - Numbers behave like setTimeout: NaN and negative values clamp to 0.
 * - Values above setTimeout's 32-bit limit (including Infinity) are capped at
 *   2147483647 ms (~24.8 days) instead of overflowing and firing immediately.
 *
 * @param {string|number|null|undefined} duration
 * @returns {number}
 */
export function toDelay(duration: string | number | null | undefined): number;
/**
 * Promise-based delay: `await sleep('500ms')`.
 *
 * - Accepts the same durations as the rest of TimeoutFlow ("500ms", "1s", 250).
 * - Numbers behave like setTimeout: NaN / negative become 0; huge values
 *   (including Infinity) are capped at ~24.8 days rather than firing at once.
 * - Invalid duration strings reject with an Error (never throw synchronously).
 * - With `signal`, rejects with `signal.reason` (an AbortError by default)
 *   and clears its timer; an already-aborted signal rejects immediately.
 *
 * @param {string|number} [duration=0]
 * @param {Object} [options]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<void>}
 */
export function sleep(duration?: string | number, { signal }?: {
    signal?: AbortSignal | undefined;
}): Promise<void>;
