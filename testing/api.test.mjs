import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import {
  parseDuration, after, every, debounce, throttle, flow,
  afterRaf, everyRaf, debounceRaf, throttleRaf, waitForRaf,
} from '../src/index.js';

function useFrames(t) {
  let id = 0;
  const pending = new Map();
  t.mock.method(globalThis, 'requestAnimationFrame', (fn) => {
    pending.set(++id, fn);
    return id;
  });
  t.mock.method(globalThis, 'cancelAnimationFrame', (key) => pending.delete(key));
  return {
    pending,
    tick(ts) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((fn) => fn(ts));
    },
  };
}

// Node has no RAF globals; restore their absence after each test.
function rafClock(t) {
  globalThis.requestAnimationFrame = () => {};
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => {
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });
  return useFrames(t);
}

describe('parseDuration', () => {
  test('parses all units, whitespace, case and fractional values', () => {
    for (const [input, expected] of [['500ms', 500], [' 1.5 S ', 1500], ['2m', 120000], ['1h', 3600000], [0, 0], [-5, -5]]) {
      assert.equal(parseDuration(input), expected);
    }
  });

  test('rejects malformed, non-finite and unsupported inputs', () => {
    for (const input of ['', '1', '-1s', '.5s', '1e3ms', '1s 2ms', '1d', '9'.repeat(400) + 'ms', NaN, Infinity, null, {}, undefined]) {
      assert.throws(() => parseDuration(input));
    }
  });
});

test('after retains its callback and cleans up abort after pause/resume', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ac = new AbortController();
  const calls = [];
  const timer = after(10, () => calls.push('run'), {
    signal: ac.signal, onFinish: () => calls.push('finish'),
  });
  t.after(() => timer.cancel());
  timer.pause();
  timer.resume();
  t.mock.timers.tick(10);
  assert.deepEqual(calls, ['run', 'finish']);
  assert.equal(timer.isFinished, true);
  assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
});

test('every stops at max and removes its abort listener', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const ac = new AbortController();
  const calls = [];
  const timer = every(10, (i) => calls.push(i), { max: 2, signal: ac.signal });
  t.after(() => timer.cancel());
  t.mock.timers.tick(10);
  t.mock.timers.tick(10);
  assert.deepEqual(calls, [0, 1]);
  assert.equal(timer.isFinished, true);
  assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
});

for (const primitive of [debounce, throttle]) {
  test(`${primitive.name} preserves latest args/context and supports flush/cancel/abort`, (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const ac = new AbortController();
    const calls = [];
    const ctx = {};
    const wrapped = primitive(1000, function (value) { calls.push([this, value]); }, { signal: ac.signal });
    wrapped.call(ctx, 1);
    wrapped.call(ctx, 2);
    wrapped.flush();
    assert.deepEqual(calls, primitive === throttle ? [[ctx, 1], [ctx, 2]] : [[ctx, 2]]);
    assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
    wrapped(3);
    wrapped.cancel();
    wrapped(4);
    ac.abort();
    t.mock.timers.tick(2000);
    assert.equal(calls.length, primitive === throttle ? 2 : 1);
    assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
  });
}

test('flow resumes an after step and completes the timeline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const calls = [];
  const runner = flow().after(10, () => calls.push('step')).onFinish(() => calls.push('finish')).start();
  t.after(() => runner.cancel());
  runner.pause();
  runner.resume();
  t.mock.timers.tick(10);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['step', 'finish']);
  assert.equal(runner.isFinished, true);
});

for (const interval of [0, 10]) {
  for (const mode of ['max', 'cancel', 'pause', 'abort']) {
    test(`everyRaf ${interval}ms leaves no queued frame after ${mode}`, (t) => {
      const clock = rafClock(t);
      const ac = new AbortController();
      let calls = 0;
      const timer = everyRaf(interval, () => {
        calls++;
        if (mode === 'cancel') timer.cancel();
        if (mode === 'pause') timer.pause();
        if (mode === 'abort') ac.abort();
      }, { max: mode === 'max' ? 1 : Infinity, signal: ac.signal });
      t.after(() => timer.cancel());
      clock.tick(0);
      if (interval) clock.tick(100);
      assert.equal(calls, 1);
      assert.equal(clock.pending.size, 0);
      assert.equal(timer.isPaused, mode === 'pause');
      if (mode !== 'pause') assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
    });
  }
}

test('afterRaf completes once and removes its listener', (t) => {
  const clock = rafClock(t);
  const ac = new AbortController();
  let calls = 0;
  const timer = afterRaf(10, () => calls++, { signal: ac.signal });
  clock.tick(0);
  clock.tick(10);
  assert.equal(calls, 1);
  assert.equal(timer.isFinished, true);
  assert.equal(clock.pending.size, 0);
  assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
});

for (const primitive of [debounceRaf, throttleRaf]) {
  test(`${primitive === debounceRaf ? 'debounceRaf' : 'throttleRaf'} flushes latest args and cancels pending frames on abort`, (t) => {
    const clock = rafClock(t);
    const ac = new AbortController();
    const calls = [];
    const ctx = {};
    const wrapped = primitive(function (value) { calls.push([this, value]); }, { signal: ac.signal });
    wrapped.call(ctx, 1);
    wrapped.call(ctx, 2);
    wrapped.flush();
    assert.deepEqual(calls, [[ctx, 2]]);
    assert.equal(clock.pending.size, 0);
    wrapped(3);
    ac.abort();
    assert.equal(clock.pending.size, 0);
    assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
  });
}

test('waitForRaf resolves void on truthy condition and cleans up', async (t) => {
  const clock = rafClock(t);
  const ac = new AbortController();
  const promise = waitForRaf(() => 'ready', { signal: ac.signal });
  clock.tick(0);
  assert.equal(await promise, undefined);
  assert.equal(clock.pending.size, 0);
  assert.equal(getEventListeners(ac.signal, 'abort').length, 0);
});
