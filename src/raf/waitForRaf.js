// ./raf/waitForRaf.js
import { parseDuration } from '../parseDuration.js';
import { attachAbort, abortReason } from '../abort.js';

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
export function waitForRaf(condition, { timeout, signal, immediate = false } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof condition !== 'function') {
      reject(new TypeError(`waitForRaf: condition must be a function, got: ${typeof condition}`));
      return;
    }

    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }

    const timeoutMs = timeout != null ? Math.max(0, parseDuration(timeout)) : null;

    let rafId = 0;
    let startedAt = null; // RAF timestamp of first tick (or immediate tick reference)

    const cleanup = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      cleanupAbort();
    };

    const onAbort = () => {
      cleanup();
      reject(abortReason(signal));
    };

    const cleanupAbort = attachAbort(signal, onAbort);

    const evaluateCondition = () => {
      try {
        return !!condition();
      } catch (err) {
        cleanup();
        reject(err);
        return null;
      }
    };

    // Optional immediate evaluation (before any frames)
    if (immediate) {
      const ok = evaluateCondition();
      if (ok === null) return;
      if (ok) {
        cleanup();
        resolve();
        return;
      }

      // If timeout is explicitly 0, and immediate failed, we can fail fast.
      if (timeoutMs === 0) {
        cleanup();
        reject(new Error('waitForRaf timed out'));
        return;
      }
    }

    const tick = (ts) => {
      // Initialize start time using the same clock as `ts`
      if (startedAt == null) startedAt = ts;

      const ok = evaluateCondition();
      if (ok === null) return;

      if (ok) {
        cleanup();
        resolve();
        return;
      }

      if (timeoutMs != null && ts - startedAt >= timeoutMs) {
        cleanup();
        reject(new Error('waitForRaf timed out'));
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
}