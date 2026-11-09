# CHANGELOG — `timeout-flow`

What changed for people using the package, per release. Entries before 0.0.20 were reconstructed from git history.

## Unreleased

- Fix: `after()` and flow steps retain their callbacks after pause/resume.
- Fix: `everyRaf()` stops scheduling frames after completion, cancellation, abort, or pause inside a callback.

## 0.0.20 — 2026-10-08

- `sleep(duration, { signal })`, a promise delay, also at `timeout-flow/sleep`.
- `retry` options: `'fixed'`, `'linear'` or `'exponential'` backoff, numeric jitter, `delayFirst`, an overall `timeout`, `isSuccess`, `onAttempt`, `attempts: Infinity`, and a `RetryError` when it gives up.
- `waitFor` runs async conditions without overlap, times out exactly, and resolves with the condition's value; its timeout error is a `TimeoutError`.
- Fix: negative `after()` and `every()` delays fire right away, like `setTimeout`, and `abort(reason)` rejects with that reason.

## 0.0.19 — 2026-05-20

- Relicensed to AGPL-3.0 with WATT3D Additional Terms.

## 0.0.18 — 2026-02-23

- Timers and their requestAnimationFrame versions share one controller: `pause()`, `resume()`, `cancel()`, `isRunning`, `isPaused` and `isFinished`. Paused time doesn't count toward a delay.
- `flush()` on `debounce` and `throttle`, and `AbortSignal` support across the timers.
- Timing uses `performance.now()`.
- Fix: `throttle` threw a TDZ error.

Behavior change: the legacy `_after` and `_every` are deprecated, and the exports are an explicit list.

## 0.0.17 — 2025-11-01

- Types: `throttle`'s return value has `.cancel()`.

## 0.0.13 — 2025-06-03

- Generated TypeScript declarations and flattened exports.

## 0.0.7 — 2025-05-15

- `debounce` and `throttle` accept the delay and the function in either order.

## 0.0.1 — 2025-05-09

- First release: `after`, `every`, `parseDuration`, the `flow` sequencer with labels, jumps, `if` / `unless` and `while` loops, `debounce`, `throttle`, `retry`, `waitFor`, and requestAnimationFrame versions of the timers.
