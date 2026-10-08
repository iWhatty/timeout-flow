# timeout-flow

[![npm](https://img.shields.io/npm/v/timeout-flow)](https://www.npmjs.com/package/timeout-flow)
[![downloads](https://img.shields.io/npm/dm/timeout-flow)](https://www.npmjs.com/package/timeout-flow)
[![bundle size](https://img.shields.io/bundlephobia/minzip/timeout-flow)](https://bundlephobia.com/package/timeout-flow)
[![license](https://img.shields.io/npm/l/timeout-flow)](https://github.com/iWhatty/timeout-flow/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/timeout-flow?style=social)](https://github.com/iWhatty/timeout-flow)
[![types](https://img.shields.io/npm/types/timeout-flow)](https://www.npmjs.com/package/timeout-flow)

Fluent, human-readable time control for JavaScript. A modern, composable upgrade to `setTimeout` and `setInterval` with chaining, conditional logic, pause/resume control, retries, and RAF utilities.

## Features

- Readable durations: `"1s"`, `"500ms"`, plain numbers
- Pause / resume / cancel controllers for `after()`, `every()`, RAF variants
- `flow()` builds declarative timelines with branching and labels
- `sleep()` promise delay with `AbortSignal` cancellation
- `retry()` with fixed/linear/exponential backoff, jitter, deadlines, result predicates and hooks
- `waitFor()` polls a sync or async predicate with an exact timeout
- RAF variants (`afterRaf`, `everyRaf`, `debounceRaf`, `throttleRaf`, `waitForRaf`) for frame-aligned timing
- ESM-first, tree-shakeable. Per-file subpath exports for size-sensitive consumers (~1.2 KB gzipped for a single primitive)
- Zero dependencies
- ~15 KB minified for the full kit (~5.5 KB gzipped)

---

## Install

```sh
pnpm add timeout-flow
```

---

## Quick start

```js
import { after } from 'timeout-flow';

function greet() {
  console.log('Hello');
}

const ctrl = after('2s', greet);

ctrl.pause();
ctrl.resume();
ctrl.cancel();
```

---

## API

### `after(duration, fn, options?)`

Run once after a delay.

```js
import { after } from 'timeout-flow';

after('2s', function greet() {
  console.log('Hello');
});
```

### `every(duration, fn, options?)`

Repeat execution with optional limit.

```js
import { every } from 'timeout-flow';

const ticker = every('1s', function tick(i) {
  console.log('Tick', i);
}, { max: 5 });
```

### `debounce(duration, fn, options?)`

Delay execution until inactivity.

```js
import { debounce } from 'timeout-flow';

const debouncedSearch = debounce('300ms', function search(event) {
  console.log('Searching for:', event.target.value);
});

debouncedSearch.cancel();
debouncedSearch.flush();
```

### `throttle(duration, fn, options?)`

Limit execution frequency.

```js
import { throttle } from 'timeout-flow';

const onScroll = throttle('250ms', function handleScroll() {
  console.log('scroll');
});

onScroll.cancel();
onScroll.flush();
```

### `sleep(duration?, options?)`

Promise-based delay with the same duration format as everything else.

```js
import { sleep } from 'timeout-flow';

await sleep('500ms');
await sleep(250);

// Cancelable: rejects with signal.reason (an AbortError by default)
// and clears its timer.
const ac = new AbortController();
await sleep('10s', { signal: ac.signal });
```

* Numbers behave like `setTimeout`: `NaN` and negative values wait 0 ms.
* Huge values (including `Infinity`) are capped at ~24.8 days instead of
  overflowing and firing immediately.
* Invalid strings (e.g. `'soon'`) reject; `sleep()` never throws synchronously.

### `retry(fn, options?)`

Retry sync or async work with delays, backoff, jitter, deadlines and hooks.

```js
import { retry } from 'timeout-flow';

async function fetchData() {
  return fetch('/api/data');
}

await retry(fetchData, {
  attempts: 5,
  delay: '500ms',
  backoff: true,
  factor: 2,
  maxDelay: '5s',
  jitter: 'decorrelated'
});
```

| Option | Default | Meaning |
| --- | --- | --- |
| `attempts` | `3` | Total attempts including the first. `Infinity` is allowed (pair it with `timeout`). |
| `delay` | `'500ms'` | Base delay between attempts. |
| `backoff` | `false` | `false`/`'fixed'`, `'linear'` (`delay * (n+1)`), `true`/`'exponential'` (`delay * factor^n`). |
| `factor` | `2` | Exponential multiplier. |
| `maxDelay` | none | Cap applied to every computed delay. |
| `jitter` | `false` | `true`/`'full'`, `'equal'`, `'decorrelated'`, or a number `j` in `[0, 1]` for proportional ±j jitter (`delay * (1 + (random()*2 - 1) * j)`, applied after the `maxDelay` cap and re-capped by it, never below 0). Other numbers or `NaN` reject with a `RangeError` before any attempt. `delayFirst` is never jittered. Delays are rounded to whole ms. |
| `delayFirst` | `false` | Wait before the first attempt: `true` uses `delay`, or pass a duration. |
| `timeout` | none | Overall deadline from the call. No retry starts after it; an in-flight attempt is not interrupted and the first attempt always runs. |
| `isSuccess(result, attempt)` | none | Return `false` to treat a resolved result as a failure and retry. |
| `shouldRetry(error, attempt)` | none | Return `false` to stop retrying. |
| `onAttempt(attempt, elapsedMs)` | none | Called before every attempt. |
| `onRetry(error, attempt, delayMs)` | none | Called after deciding to retry, before waiting. |
| `signal` | none | Abort waiting and further attempts. |
| `sleep(ms, { signal })` | built-in `sleep` | Injectable wait, e.g. for fake-timer tests. |
| `now()` | `performance.now` | Injectable clock used for `timeout`. |
| `random()` | `Math.random` | Injectable RNG for jitter. |

Attempt numbers are **0-based** everywhere (`fn(attempt)`, hooks, predicates).

Outcome:

* Resolves with the first successful result.
* Otherwise rejects with the **last failure**: the last thrown error as-is, or,
  if the last attempt resolved with a result `isSuccess` rejected, an error
  with `name: 'RetryError'`, `.result` (that last result) and `.attempts`.
* On abort, rejects with `signal.reason` (an `AbortError` by default).

#### Retry recipes

Retry until a result looks right, with a little log line per attempt:

```js
const response = await retry(() => sendMessage(tabId, msg), {
  attempts: 4,
  delay: 200,
  backoff: 'exponential',
  maxDelay: '2s',
  isSuccess: (res) => res?.ok === true,
  onAttempt: (attempt, elapsed) => console.debug('attempt', attempt, Math.round(elapsed), 'ms'),
});
```

Exponential backoff with ±15% proportional jitter:

```js
await retry(poll, {
  attempts: 5,
  delay: 200,
  backoff: true,
  factor: 1.6,
  maxDelay: '1500ms',
  jitter: 0.15, // each wait lands within 85%..115% of its computed delay
});
```

Time-bounded retry (deadline instead of an attempt count):

```js
await retry(() => connect(), {
  attempts: Infinity,
  delay: '250ms',
  timeout: '5s',
});
```

Give something a moment to settle before the first try, and stop on fatal errors:

```js
await retry(loadConfig, {
  delayFirst: '100ms',
  attempts: 3,
  backoff: 'linear',
  shouldRetry: (err) => err.name !== 'SyntaxError',
});
```

Return a result object instead of throwing:

```js
const outcome = await retry(task, { attempts: 3 }).then(
  (value) => ({ ok: true, value }),
  (error) => ({ ok: false, error, value: error?.result })
);
```

Deterministic tests without real timers:

```js
let clock = 0;
const waits = [];

await retry(task, {
  attempts: 4,
  delay: 100,
  backoff: true,
  now: () => clock,
  sleep: async (ms) => { waits.push(ms); clock += ms; },
}).catch(() => {});

// waits -> [100, 200, 400]
```

### `waitFor(predicate, options?)`

Wait until a condition becomes truthy. Resolves with the condition's value.

```js
import { waitFor } from 'timeout-flow';

const el = await waitFor(function findLoaded() {
  return document.querySelector('#loaded');
}, {
  interval: '250ms',
  timeout: '5s',
  immediate: true
});
```

Timing model:

* The first check runs after `interval` unless `immediate: true`.
* Conditions may be async; the next check is scheduled `interval` after the
  previous one settles, so checks never overlap.
* `timeout` is measured from the call and has its own timer, so it is not
  rounded up to the next poll. At the deadline a sync condition gets one final
  check, so success at exactly `timeout` counts (`elapsed >= timeout` times out
  only if the condition is still falsy). It rejects with an `Error` named
  `'TimeoutError'` (message `'waitFor timed out'`).
* `signal` rejects with `signal.reason`.

`waitForRaf()` checks once per animation frame and measures `timeout` from the
first frame's timestamp (RAF time), timing out once `elapsed >= timeout`.

### `flow()`

Build declarative time flows.

```js
import { flow } from 'timeout-flow';

flow()
  .after('1s', function stepOne() {
    console.log('Step 1');
  })
  .every('500ms', function tick(i) {
    console.log('Tick', i);
  }, { max: 3 })
  .after('1s', function finalStep() {
    console.log('Final Step');
  })
  .start();
```

Flow reads like a timeline and keeps duration-first ordering for readability.

### RAF utilities

Frame-based timing powered by `requestAnimationFrame`. Ideal for visual updates, scroll handlers, layout checks, and animation loops.

Available: `afterRaf()`, `everyRaf()`, `debounceRaf()`, `throttleRaf()`, `waitForRaf()`.

```js
import { throttleRaf } from 'timeout-flow';

const onScroll = throttleRaf(function drawFrame() {
  console.log('draw');
});

onScroll.cancel();
onScroll.flush();
```

### Controllers

Most time-based primitives return a controller object:

```js
const ctrl = after('1s', () => console.log('done'));

ctrl.pause();
ctrl.resume();
ctrl.cancel();
ctrl.reset?.();

console.log(ctrl.isRunning);
console.log(ctrl.isPaused);
console.log(ctrl.isFinished);
```

Shared by `after()`, `every()`, `afterRaf()`, `everyRaf()`. All controllers are pause-safe (paused time does not count), cancel-safe, monotonic-time based, and `AbortSignal`-aware where supported.

### AbortSignal support

Many utilities accept `{ signal }` for automatic cancellation.

```js
import { after } from 'timeout-flow';

const ac = new AbortController();

after('2s', function doWork() {
  console.log('Will not run if aborted');
}, { signal: ac.signal });

ac.abort();
```

If already aborted at creation time, no work is scheduled.

### Public surface

```js
import {
  after,
  every,
  debounce,
  throttle,
  sleep,
  retry,
  waitFor,
  flow,

  afterRaf,
  everyRaf,
  debounceRaf,
  throttleRaf,
  waitForRaf
} from 'timeout-flow';
```

---

## Notes

### Tree-shaking and per-primitive imports

Two import styles, same package, choose by bundle-size sensitivity:

```js
// Full kit. Every primitive available on one import.
// Modern bundlers (esbuild, vite, rollup, webpack 5) will tree-shake
// unused exports because the package ships `sideEffects: false` and the
// `.` entrypoint points at ESM source instead of a pre-minified blob.
import { after, debounce, retry } from 'timeout-flow';
```

```js
// Per-primitive subpath. Explicit minimum surface, useful when you know
// you only need one primitive and want the bundle to reflect that
// without relying on the bundler's tree-shaker. Same source either way.
import { after }     from 'timeout-flow/after';
import { every }     from 'timeout-flow/every';
import { debounce }  from 'timeout-flow/debounce';
import { throttle }  from 'timeout-flow/throttle';
import { sleep }     from 'timeout-flow/sleep';
import { retry }     from 'timeout-flow/retry';
import { waitFor }   from 'timeout-flow/wait-for';
import { flow }      from 'timeout-flow/flow';
import { afterRaf, everyRaf, debounceRaf, throttleRaf, waitForRaf } from 'timeout-flow/raf';
import { parseDuration } from 'timeout-flow/parse-duration';
```

Measured for a single `after()` call in a typical browser bundler (esbuild, minified + gzip):

| Import style | Gzip |
|---|---:|
| pre-0.0.19 default (full minified bundle) | 5098 bytes |
| 0.0.19 default (`import { after } from 'timeout-flow'`) | 1199 bytes |
| 0.0.19 subpath (`import { after } from 'timeout-flow/after'`) | 1199 bytes |

For unbundled `<script type="module">` consumption of the full kit, use the **`timeout-flow/min`** subpath, which points at the pre-built minified IIFE.

### Clean signatures

timeout-flow supports both natural-language and function-first argument ordering:

```js
after('1s', done);
// or
after(done, '1s');
```

This applies to `after()`, `every()`, `debounce()`, `throttle()`. Use whichever reads best in your codebase.

### Philosophy

timeout-flow is not just a wrapper around timers, it's a composable toolkit for expressing time as readable logic. Temporal behavior should be:

- **Readable.** Durations like `"1s"` and `"500ms"` beat magic numbers.
- **Composable.** Sequencing should be declarative.
- **Controllable.** Timers should pause, resume, cancel.
- **Branchable.** Real flows need `if`, `while`, `label`, `jumpTo()`.
- **Tiny.** No runtime bloat.

> Think of timeout-flow as `setTimeout()` with superpowers.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
