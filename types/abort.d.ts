/**
 * Attach an AbortSignal listener and return a cleanup function.
 * - If `signal` is missing, returns a no-op cleanup.
 * - If already aborted, calls `onAbort()` immediately and returns a no-op cleanup.
 *
 * @param {AbortSignal | null | undefined} signal
 * @param {() => void} onAbort
 * @returns {() => void} cleanup
 */
export function attachAbort(signal: AbortSignal | null | undefined, onAbort: () => void): () => void;
/**
 * Manage AbortSignal listener lifecycle for "pending work" cases.
 * Call `add()` when work becomes pending and `remove()` when it’s resolved/canceled.
 *
 * @param {AbortSignal | null | undefined} signal
 * @param {() => void} onAbort
 * @returns {{ add: () => void, remove: () => void, reset: () => void }}
 */
export function pendingAbort(signal: AbortSignal | null | undefined, onAbort: () => void): {
    add: () => void;
    remove: () => void;
    reset: () => void;
};
/**
 * The error an aborted operation should reject with: the signal's own
 * `reason` (what `fetch()` and other web APIs use), falling back to a
 * standard AbortError for runtimes without `AbortSignal.reason`.
 *
 * @param {AbortSignal | null | undefined} signal
 * @returns {any}
 */
export function abortReason(signal: AbortSignal | null | undefined): any;
/**
 * Standardized AbortError factory.
 * Works in browsers and Node runtimes that may not have DOMException.
 *
 * We resolve the best implementation once at module load time.
 * This avoids feature detection in the hot path.
 */
export let createAbortError: any;
