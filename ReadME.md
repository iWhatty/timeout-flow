# TimeoutFlow

[![npm](https://img.shields.io/npm/v/timeout-flow)](https://www.npmjs.com/package/timeout-flow)
[![gzip size](https://img.shields.io/bundlephobia/minzip/timeout-flow)](https://bundlephobia.com/package/timeout-flow)
[![downloads](https://img.shields.io/npm/dw/timeout-flow)](https://www.npmjs.com/package/timeout-flow)
[![GitHub stars](https://img.shields.io/github/stars/iWhatty/TimeoutFlow-js?style=social)](https://github.com/iWhatty/TimeoutFlow-js)

**Fluent, human-readable time control for JavaScript.**

TimeoutFlow makes working with time-based logic intuitive — think of it as a modern, composable upgrade to `setTimeout` and `setInterval`, with chaining, conditional logic, pause/resume control, retries, RAF utilities, and more.

* Minified: ~6–7 KB
* Gzipped: ~2–3 KB
* Zero dependencies
* ESM-first, tree-shakeable

---

# Philosophy

TimeoutFlow is not just a wrapper around timers.
It’s a composable toolkit for expressing time as readable logic.

Temporal behavior should be:

* **Readable** — durations like `"1s"` and `"500ms"` beat magic numbers.
* **Composable** — sequencing should be declarative.
* **Controllable** — timers should pause, resume, cancel.
* **Branchable** — real flows need `if`, `while`, `label`, `jumpTo()`.
* **Tiny** — no runtime bloat.

> Think of TimeoutFlow as `setTimeout()` with superpowers.

---

# Clean Signatures

TimeoutFlow supports **both** natural-language ordering and function-first ordering.

You can write:

```js
after('1s', done);
```

Or:

```js
after(done, '1s');
```

Both are valid.

This applies to:

* `after()`
* `every()`
* `debounce()`
* `throttle()`

Use whichever reads best in your codebase.

---

# Installation

```bash
npm install timeout-flow
```

---

# Unified Control Surface

Most time-based primitives return a **controller object**:

```js
import { after } from 'timeout-flow';

function done() {
  console.log('done');
}

const ctrl = after('1s', done);

ctrl.pause();
ctrl.resume();
ctrl.cancel();
ctrl.reset?.();

console.log(ctrl.isRunning);
console.log(ctrl.isPaused);
console.log(ctrl.isFinished);
```

Shared by:

* `after()`
* `every()`
* `afterRaf()`
* `everyRaf()`

All controllers are:

* Pause-safe (paused time does not count)
* Cancel-safe
* Monotonic-time based
* AbortSignal-aware (where supported)

---

# Core Primitives

## after()

Run once after a delay.

```js
import { after } from 'timeout-flow';

function greet() {
  console.log('Hello');
}

after('2s', greet);
```

---

## every()

Repeat execution with optional limit.

```js
import { every } from 'timeout-flow';

function tick(i) {
  console.log('Tick', i);
}

const ticker = every('1s', tick, { max: 5 });
```

---

## debounce()

Delay execution until inactivity.

```js
import { debounce } from 'timeout-flow';

function search(event) {
  console.log('Searching for:', event.target.value);
}

const debouncedSearch = debounce('300ms', search);

debouncedSearch.cancel();
debouncedSearch.flush();
```

---

## throttle()

Limit execution frequency.

```js
import { throttle } from 'timeout-flow';

function handleScroll() {
  console.log('scroll');
}

const onScroll = throttle('250ms', handleScroll);

onScroll.cancel();
onScroll.flush();
```

---

## sleep()

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

---

## retry()

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

### Retry recipes

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

---

## waitFor()

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

---

# Fluent Timeline

Build declarative time flows.

```js
import { flow } from 'timeout-flow';

function stepOne() {
  console.log('Step 1');
}

function tick(i) {
  console.log('Tick', i);
}

function finalStep() {
  console.log('Final Step');
}

flow()
  .after('1s', stepOne)
  .every('500ms', tick, { max: 3 })
  .after('1s', finalStep)
  .start();
```

Flow reads like a timeline and keeps duration-first ordering for readability.

---

# AbortSignal Support

Many utilities accept `{ signal }` for automatic cancellation.

```js
import { after } from 'timeout-flow';

const ac = new AbortController();

function doWork() {
  console.log('Will not run if aborted');
}

after('2s', doWork, { signal: ac.signal });

ac.abort();
```

If already aborted at creation time, no work is scheduled.

---

# RAF Utilities

Frame-based timing powered by `requestAnimationFrame`.

Ideal for visual updates, scroll handlers, layout checks, and animation loops.

## Available

* `afterRaf()`
* `everyRaf()`
* `debounceRaf()`
* `throttleRaf()`
* `waitForRaf()`

## Example

```js
import { throttleRaf } from 'timeout-flow';

function drawFrame() {
  console.log('draw');
}

const onScroll = throttleRaf(drawFrame);

onScroll.cancel();
onScroll.flush();
```

---

# Public API

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

# License

--{DR.WATT v3.0}--
