// ./src/TimerBase.js
import { parseDuration } from './parseDuration.js';
import { now } from './now.js'


/**
 * Base timer class to manage pause/resume/cancel behavior.
 * Not meant to be used directly—subclass for concrete behavior.
 */
export class TimerBase {
  #ms;
  #startTime = null; // performance.now()
  #remaining;
  #timer = null;

  #running = false;
  #paused = false;
  #finished = false;

  /**
   * @param {string|number} duration - The duration to wait in ms or shorthand format
   */
  constructor(duration) {
    this.#ms = parseDuration(duration);
    this.#remaining = this.#ms;
  }

  /**
   * Whether the timer is currently running (actively counting down).
   * @returns {boolean}
   */
  get isRunning() {
    return this.#running;
  }

  /**
   * Whether the timer is paused (resumable).
   * @returns {boolean}
   */
  get isPaused() {
    return this.#paused;
  }

  /**
   * Whether the timer has finished or been canceled (terminal state).
   * @returns {boolean}
   */
  get isFinished() {
    return this.#finished;
  }

  /**
   * Pause the active timer, storing remaining time.
   */
  pause() {
    if (!this.#running) return;

    clearTimeout(this.#timer);
    this.#timer = null;

    const elapsed = now() - this.#startTime;
    this.#remaining = Math.max(0, this.#remaining - elapsed);

    this.#running = false;
    this.#paused = true;
    // not finished; still resumable
  }

  /**
   * Resume the timer using the remaining time (or an override delay).
   * @param {Function} callback - Called when time completes
   * @param {number|null} [overrideDelay=null] - Optional custom delay in ms
   */
  resume(callback, overrideDelay = null) {
    if (this.#finished) return;
    if (this.#running) return;

    const rawDelay = overrideDelay ?? this.#remaining;

    // Reject invalid delays (avoid scheduling with NaN/Infinity/etc.)
    if (!Number.isFinite(rawDelay)) return;

    // Negative delays clamp to 0 like setTimeout (next macrotask)
    // instead of silently never firing.
    const delay = Math.max(0, rawDelay);

    // Important: remaining must reflect what we actually scheduled,
    // otherwise pause() math will be wrong when overrideDelay is used.
    this.#remaining = delay;

    this.#startTime = now();
    this.#running = true;
    this.#paused = false;

    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.#running = false;
      this.#paused = false;
      this.#finished = true;
      this.#remaining = 0;
      callback?.();
    }, delay);
  }

  /**
   * Cancel the timer immediately (terminal).
   */
  cancel() {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;

    this.#running = false;
    this.#paused = false;
    this.#finished = true;
    // leave #remaining as-is or set to 0; prefer 0 for "terminal means done"
    this.#remaining = 0;
  }

  /**
   * Reset the timer to its original delay, cancelling if needed.
   * After reset, the timer is not running.
   */
  reset() {
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;

    this.#startTime = null;
    this.#remaining = this.#ms;

    this.#running = false;
    this.#paused = false;
    this.#finished = false;
  }
}