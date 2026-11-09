/**
 * Base timer class to manage pause/resume/cancel behavior.
 * Not meant to be used directly—subclass for concrete behavior.
 */
export class TimerBase {
    /**
     * @param {string|number} duration - The duration to wait in ms or shorthand format
     */
    constructor(duration: string | number);
    /**
     * Whether the timer is currently running (actively counting down).
     * @returns {boolean}
     */
    get isRunning(): boolean;
    /**
     * Whether the timer is paused (resumable).
     * @returns {boolean}
     */
    get isPaused(): boolean;
    /**
     * Whether the timer has finished or been canceled (terminal state).
     * @returns {boolean}
     */
    get isFinished(): boolean;
    /**
     * Pause the active timer, storing remaining time.
     */
    pause(): void;
    /**
     * Resume the timer using the remaining time (or an override delay).
     * @param {Function} [callback] - Called when time completes; defaults to the previous callback
     * @param {number|null} [overrideDelay=null] - Optional custom delay in ms
     */
    resume(callback?: Function, overrideDelay?: number | null): void;
    /**
     * Cancel the timer immediately (terminal).
     */
    cancel(): void;
    /**
     * Reset the timer to its original delay, cancelling if needed.
     * After reset, the timer is not running.
     */
    reset(): void;
    #private;
}
