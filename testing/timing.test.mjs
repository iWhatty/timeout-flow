// testing/timing.test.mjs
// Unit tests for sleep / retry / waitFor / after edge cases.
// Run with: npm test   (uses the built-in node:test runner; no dependencies)

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { sleep, retry, waitFor, after } from '../src/index.js';

// ---------- helpers ----------

/** Drain pending microtasks/promise chains (setImmediate is not mocked). */
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Track promise settlement without awaiting it. */
function track(promise) {
  const state = { settled: false, value: undefined, error: undefined };
  promise.then(
    (value) => { state.settled = true; state.value = value; },
    (error) => { state.settled = true; state.error = error; }
  );
  return state;
}

/** Advance mocked timers in small steps, flushing promise chains between ticks. */
async function advance(t, ms, step = 1) {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    t.mock.timers.tick(Math.min(step, ms - elapsed));
    await flush();
  }
}

function useFakeTimers(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
}

/** Fake clock + sleep for retry(): sleeping advances the clock instantly. */
function fakeClock() {
  let time = 0;
  const sleeps = [];
  return {
    sleeps,
    now: () => time,
    advance: (ms) => { time += ms; },
    sleep: async (ms) => { sleeps.push(ms); time += ms; },
  };
}

/** Minimal signal that records listener bookkeeping. */
function spySignal() {
  const listeners = new Set();
  return {
    aborted: false,
    reason: undefined,
    listeners,
    addEventListener: (_type, fn) => listeners.add(fn),
    removeEventListener: (_type, fn) => listeners.delete(fn),
  };
}

const failing = (message = 'boom') => () => { throw new Error(message); };

// ---------- sleep ----------

describe('sleep', () => {
  test('accepts duration strings', async (t) => {
    useFakeTimers(t);
    const s = track(sleep('1s'));
    await advance(t, 999, 333);
    assert.equal(s.settled, false);
    await advance(t, 1);
    assert.equal(s.settled, true);
    assert.equal(s.error, undefined);
  });

  test('accepts numbers (ms) and defaults to 0', async (t) => {
    useFakeTimers(t);
    const a = track(sleep(50));
    const b = track(sleep());
    await advance(t, 1);
    assert.equal(b.settled, true);
    assert.equal(a.settled, false);
    await advance(t, 49);
    assert.equal(a.settled, true);
  });

  test('NaN and negative numbers clamp to 0 like setTimeout', async (t) => {
    useFakeTimers(t);
    const nan = track(sleep(NaN));
    const neg = track(sleep(-500));
    t.mock.timers.tick(0);
    await flush();
    assert.equal(nan.settled, true);
    assert.equal(neg.settled, true);
    assert.equal(nan.error, undefined);
    assert.equal(neg.error, undefined);
  });

  test('Infinity is capped instead of firing immediately', async (t) => {
    useFakeTimers(t);
    const s = track(sleep(Infinity));
    await advance(t, 1000, 500);
    assert.equal(s.settled, false);
    t.mock.timers.tick(2_147_483_647);
    await flush();
    assert.equal(s.settled, true);
  });

  test('invalid strings reject (never throw synchronously)', async () => {
    let promise;
    assert.doesNotThrow(() => { promise = sleep('soon'); });
    await assert.rejects(promise, /Invalid duration format/);
  });

  test('abort mid-wait rejects with an AbortError and clears the timer', async () => {
    const active = () => process.getActiveResourcesInfo().filter((r) => r === 'Timeout').length;
    const before = active();
    const ac = new AbortController();
    const p = sleep('10s', { signal: ac.signal });
    assert.equal(active(), before + 1);
    ac.abort();
    await assert.rejects(p, { name: 'AbortError' });
    assert.equal(active(), before);
  });

  test('abort rejects with the signal reason when provided', async () => {
    const ac = new AbortController();
    const reason = new Error('navigated away');
    const p = sleep('10s', { signal: ac.signal });
    ac.abort(reason);
    await assert.rejects(p, (err) => err === reason);
  });

  test('already-aborted signal rejects immediately', async () => {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(sleep('1h', { signal: ac.signal }), { name: 'AbortError' });
  });

  test('removes its abort listener after resolving', async (t) => {
    useFakeTimers(t);
    const signal = spySignal();
    const s = track(sleep(10, { signal }));
    assert.equal(signal.listeners.size, 1);
    await advance(t, 10);
    assert.equal(s.settled, true);
    assert.equal(signal.listeners.size, 0);
  });
});

// ---------- retry ----------

describe('retry', () => {
  test('defaults: 3 attempts, fixed 500ms delay, throws the last error', async () => {
    const clock = fakeClock();
    let calls = 0;
    await assert.rejects(
      retry(() => { calls++; throw new Error(`fail ${calls}`); }, { sleep: clock.sleep }),
      { message: 'fail 3' }
    );
    assert.equal(calls, 3);
    assert.deepEqual(clock.sleeps, [500, 500]);
  });

  test('returns the first successful result and passes 0-based attempt to fn', async () => {
    const clock = fakeClock();
    const seen = [];
    const result = await retry((attempt) => {
      seen.push(attempt);
      if (attempt < 2) throw new Error('not yet');
      return 'ok';
    }, { sleep: clock.sleep });
    assert.equal(result, 'ok');
    assert.deepEqual(seen, [0, 1, 2]);
  });

  test('backoff strategies: fixed, linear, exponential (true), with factor', async () => {
    const run = async (opts) => {
      const clock = fakeClock();
      await retry(failing(), { attempts: 4, delay: 100, sleep: clock.sleep, ...opts }).catch(() => { });
      return clock.sleeps;
    };
    assert.deepEqual(await run({ backoff: false }), [100, 100, 100]);
    assert.deepEqual(await run({ backoff: 'fixed' }), [100, 100, 100]);
    assert.deepEqual(await run({ backoff: 'linear' }), [100, 200, 300]);
    assert.deepEqual(await run({ backoff: true }), [100, 200, 400]);
    assert.deepEqual(await run({ backoff: 'exponential', factor: 3 }), [100, 300, 900]);
  });

  test('maxDelay caps each computed delay', async () => {
    const clock = fakeClock();
    await retry(failing(), {
      attempts: 5, delay: '100ms', backoff: true, maxDelay: '250ms', sleep: clock.sleep,
    }).catch(() => { });
    assert.deepEqual(clock.sleeps, [100, 200, 250, 250]);
  });

  test('jittered delays are rounded to whole ms', async () => {
    const clock = fakeClock();
    await retry(failing(), {
      attempts: 3, delay: 99, jitter: 'full', random: () => 0.5, sleep: clock.sleep,
    }).catch(() => { });
    assert.deepEqual(clock.sleeps, [50, 50]);
  });

  test('delayFirst: true waits `delay` before the first attempt', async () => {
    const clock = fakeClock();
    const starts = [];
    await retry(() => { starts.push(clock.now()); return 'ok'; }, {
      delay: '200ms', delayFirst: true, sleep: clock.sleep, now: clock.now,
    });
    assert.deepEqual(clock.sleeps, [200]);
    assert.deepEqual(starts, [200]);
  });

  test('delayFirst accepts an explicit duration', async () => {
    const clock = fakeClock();
    await retry(failing(), {
      attempts: 2, delay: 100, delayFirst: '1s', sleep: clock.sleep,
    }).catch(() => { });
    assert.deepEqual(clock.sleeps, [1000, 100]);
  });

  test('isSuccess: unsuccessful results are retried, success returned', async () => {
    const clock = fakeClock();
    const results = [{ ok: false }, { ok: false }, { ok: true, value: 42 }];
    let i = 0;
    const out = await retry(() => results[i++], {
      attempts: 5, delay: 10, isSuccess: (r) => r.ok, sleep: clock.sleep,
    });
    assert.deepEqual(out, { ok: true, value: 42 });
    assert.equal(i, 3);
  });

  test('isSuccess: exhaustion rejects with RetryError carrying the last result', async () => {
    const clock = fakeClock();
    let i = 0;
    await assert.rejects(
      retry(() => ({ ok: false, n: i++ }), {
        attempts: 3, delay: 10, isSuccess: async (r) => r.ok, sleep: clock.sleep,
      }),
      (err) => {
        assert.equal(err.name, 'RetryError');
        assert.ok(err instanceof Error);
        assert.deepEqual(err.result, { ok: false, n: 2 });
        assert.equal(err.attempts, 3);
        return true;
      }
    );
  });

  test('isSuccess receives the attempt number', async () => {
    const clock = fakeClock();
    const seen = [];
    await retry(() => 'x', {
      attempts: 3, delay: 1, sleep: clock.sleep,
      isSuccess: (_r, attempt) => { seen.push(attempt); return attempt === 1; },
    });
    assert.deepEqual(seen, [0, 1]);
  });

  test('shouldRetry(false) stops early with that failure', async () => {
    const clock = fakeClock();
    const seen = [];
    let calls = 0;
    await assert.rejects(
      retry(() => { calls++; throw new Error(calls === 1 ? 'transient' : 'fatal'); }, {
        attempts: 10, delay: 1, sleep: clock.sleep,
        shouldRetry: (err, attempt) => { seen.push([err.message, attempt]); return err.message !== 'fatal'; },
      }),
      { message: 'fatal' }
    );
    assert.equal(calls, 2);
    assert.deepEqual(seen, [['transient', 0], ['fatal', 1]]);
  });

  test('shouldRetry sees RetryError for unsuccessful results', async () => {
    const clock = fakeClock();
    let seen;
    await retry(() => 'nope', {
      attempts: 3, delay: 1, sleep: clock.sleep,
      isSuccess: () => false,
      shouldRetry: (err) => { seen = err; return false; },
    }).catch(() => { });
    assert.equal(seen.name, 'RetryError');
    assert.equal(seen.result, 'nope');
  });

  test('onAttempt and onRetry receive correct attempt numbers, elapsed and delays', async () => {
    const clock = fakeClock();
    const attemptsSeen = [];
    const retriesSeen = [];
    await retry(() => { clock.advance(5); throw new Error('x'); }, {
      attempts: 3, delay: 100, backoff: 'linear', sleep: clock.sleep, now: clock.now,
      onAttempt: (attempt, elapsedMs) => { attemptsSeen.push([attempt, elapsedMs]); },
      onRetry: (err, attempt, delayMs) => { retriesSeen.push([err.message, attempt, delayMs]); },
    }).catch(() => { });
    assert.deepEqual(attemptsSeen, [[0, 0], [1, 105], [2, 310]]);
    assert.deepEqual(retriesSeen, [['x', 0, 100], ['x', 1, 200]]);
  });

  test('timeout: deadline bounds retries (attempts: Infinity)', async () => {
    const clock = fakeClock();
    const starts = [];
    await assert.rejects(
      retry(() => { starts.push(clock.now()); throw new Error('down'); }, {
        attempts: Infinity, delay: 100, timeout: '350ms', sleep: clock.sleep, now: clock.now,
      }),
      { message: 'down' }
    );
    // 0,100,200,300 started; the next would start at 400 > 350.
    assert.deepEqual(starts, [0, 100, 200, 300]);
  });

  test('timeout: an attempt may start exactly at the deadline', async () => {
    const clock = fakeClock();
    let calls = 0;
    await retry(() => { calls++; throw new Error('x'); }, {
      attempts: Infinity, delay: 100, timeout: 300, sleep: clock.sleep, now: clock.now,
    }).catch(() => { });
    assert.equal(calls, 4); // 0,100,200,300
  });

  test('timeout counts time spent inside attempts', async () => {
    const clock = fakeClock();
    let calls = 0;
    await retry(() => { calls++; clock.advance(200); throw new Error('slow'); }, {
      attempts: 10, delay: 100, timeout: '1s', sleep: clock.sleep, now: clock.now,
    }).catch(() => { });
    // starts at 0, 300, 600, 900; next would be 1200 > 1000
    assert.equal(calls, 4);
  });

  test('deadline vs attempts: whichever is reached first wins', async () => {
    const clock = fakeClock();
    let calls = 0;
    await retry(() => { calls++; throw new Error('x'); }, {
      attempts: 2, delay: 100, timeout: '10s', sleep: clock.sleep, now: clock.now,
    }).catch(() => { });
    assert.equal(calls, 2);
  });

  test('timeout still runs the first attempt', async () => {
    const clock = fakeClock();
    let calls = 0;
    await retry(() => { calls++; throw new Error('x'); }, {
      attempts: 5, delay: 100, timeout: 0, sleep: clock.sleep, now: clock.now,
    }).catch(() => { });
    assert.equal(calls, 1);
  });

  test('attempts: Infinity keeps retrying until success', async () => {
    const clock = fakeClock();
    const out = await retry((attempt) => {
      if (attempt < 20) throw new Error('x');
      return attempt;
    }, { attempts: Infinity, delay: 1, sleep: clock.sleep });
    assert.equal(out, 20);
  });

  test('abort mid-wait rejects with the reason and stops attempts (real sleep, fake timers)', async (t) => {
    useFakeTimers(t);
    const ac = new AbortController();
    let calls = 0;
    const r = track(retry(() => { calls++; throw new Error('x'); }, {
      attempts: 5, delay: '1s', signal: ac.signal,
    }));
    await advance(t, 500, 100);
    assert.equal(calls, 1);
    ac.abort();
    await flush();
    assert.equal(r.settled, true);
    assert.equal(r.error.name, 'AbortError');
    await advance(t, 2000, 500);
    assert.equal(calls, 1);
  });

  test('abort is honoured even when an injected sleep ignores the signal', async () => {
    const ac = new AbortController();
    const reason = new Error('stop');
    let calls = 0;
    await assert.rejects(
      retry(() => { calls++; throw new Error('x'); }, {
        attempts: 5, delay: 10, signal: ac.signal,
        sleep: async () => { ac.abort(reason); },
      }),
      (err) => err === reason
    );
    assert.equal(calls, 1);
  });

  test('abort during delayFirst prevents any attempt', async () => {
    const ac = new AbortController();
    let calls = 0;
    const p = retry(() => { calls++; }, { delayFirst: '1s', signal: ac.signal });
    ac.abort();
    await assert.rejects(p, { name: 'AbortError' });
    assert.equal(calls, 0);
  });

  test('already-aborted signal rejects without calling fn', async () => {
    const ac = new AbortController();
    ac.abort();
    let calls = 0;
    await assert.rejects(retry(() => { calls++; }, { signal: ac.signal }), { name: 'AbortError' });
    assert.equal(calls, 0);
  });

  test('rejects with TypeError when fn is not a function', async () => {
    await assert.rejects(retry('nope'), TypeError);
  });
});

// ---------- waitFor ----------

describe('waitFor', () => {
  test('first check runs after interval by default and resolves with the truthy value', async (t) => {
    useFakeTimers(t);
    let checks = 0;
    const w = track(waitFor(() => { checks++; return checks >= 2 && 'ready'; }, { interval: '100ms' }));
    await flush();
    assert.equal(checks, 0);
    await advance(t, 100, 50);
    assert.equal(checks, 1);
    await advance(t, 100, 50);
    assert.equal(w.settled, true);
    assert.equal(w.value, 'ready');
  });

  test('immediate: true checks synchronously first', async () => {
    let checks = 0;
    const value = await waitFor(() => ++checks, { immediate: true });
    assert.equal(value, 1);
  });

  test('supports async conditions without overlapping checks', async (t) => {
    useFakeTimers(t);
    let inFlight = 0;
    let maxInFlight = 0;
    let calls = 0;
    const condition = () => new Promise((resolve) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      calls++;
      setTimeout(() => { inFlight--; resolve(calls >= 3); }, 150);
    });
    const w = track(waitFor(condition, { interval: 50 }));
    await advance(t, 1000, 10);
    assert.equal(w.settled, true);
    assert.equal(w.value, true);
    assert.equal(maxInFlight, 1);
  });

  test('timeout rejects at the deadline, not at the next poll', async (t) => {
    useFakeTimers(t);
    const w = track(waitFor(() => false, { interval: '1s', timeout: '300ms' }));
    await advance(t, 299, 299);
    assert.equal(w.settled, false);
    await advance(t, 1);
    assert.equal(w.settled, true);
    assert.equal(w.error.name, 'TimeoutError');
    assert.equal(w.error.message, 'waitFor timed out');
  });

  test('a condition that becomes true exactly at the deadline succeeds (>=)', async (t) => {
    useFakeTimers(t);
    let elapsed = 0;
    const w = track(waitFor(() => elapsed >= 300, { interval: 100, timeout: 300 }));
    for (let i = 0; i < 3; i++) {
      elapsed += 100;
      await advance(t, 100, 100);
    }
    assert.equal(w.settled, true);
    assert.equal(w.error, undefined);
    assert.equal(w.value, true);
  });

  test('abort rejects with the signal reason', async () => {
    const ac = new AbortController();
    const p = waitFor(() => false, { interval: 10, signal: ac.signal });
    ac.abort();
    await assert.rejects(p, { name: 'AbortError' });
  });

  test('a throwing condition rejects with that error', async () => {
    await assert.rejects(
      waitFor(() => { throw new Error('bad selector'); }, { immediate: true }),
      { message: 'bad selector' }
    );
  });
});

// ---------- after ----------

describe('after', () => {
  test('negative delays fire on the next tick like setTimeout', async (t) => {
    useFakeTimers(t);
    let fired = false;
    const timer = after(() => { fired = true; }, -50);
    t.mock.timers.tick(0);
    assert.equal(fired, true);
    assert.equal(timer.isFinished, true);
  });

  test('NaN delays still throw (explicit duration required)', () => {
    assert.throws(() => after(() => { }, NaN), TypeError);
  });
});
