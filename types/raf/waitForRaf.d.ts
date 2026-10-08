/**
 * Waits for a condition to return truthy, polling each frame.
 *
 * Timing model:
 * - Evaluates `condition()` once per animation frame until it returns truthy.
 * - If `timeout` is provided, timeout is measured in RAF time (frame timestamps).
 *
 * @param {Function} condition - Function returning truthy when complete
 * @param {Object} [options]
 * @param {string|number} [options.timeout] - Optional max time to wait
 * @param {AbortSignal} [options.signal] - Optional AbortSignal; rejects with `signal.reason`
 * @param {boolean} [options.immediate=false] - If true, evaluate condition immediately before first frame
 * @returns {Promise<void>} Resolves when condition is met, rejects on timeout/abort
 */
export function waitForRaf(condition: Function, { timeout, signal, immediate }?: {
    timeout?: string | number | undefined;
    signal?: AbortSignal | undefined;
    immediate?: boolean | undefined;
}): Promise<void>;
