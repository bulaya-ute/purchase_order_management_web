import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedFetch } from './requestCache.ts';

test('calls the fetcher and returns its result on a fresh key', async () => {
  const result = await cachedFetch('key-1', async () => 'hello');
  assert.equal(result, 'hello');
});

test('does not call the fetcher again for a repeated key within the TTL', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return calls;
  };

  const first = await cachedFetch('key-2', fetcher, 60_000);
  const second = await cachedFetch('key-2', fetcher, 60_000);

  assert.equal(first, 1);
  assert.equal(second, 1);
  assert.equal(calls, 1);
});

test('calls the fetcher again once the TTL has expired', async (t) => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return calls;
  };

  t.mock.timers.enable({ apis: ['Date'] });

  const first = await cachedFetch('key-3', fetcher, 1_000);
  t.mock.timers.tick(1_001);
  const second = await cachedFetch('key-3', fetcher, 1_000);

  assert.equal(first, 1);
  assert.equal(second, 2);
  assert.equal(calls, 2);
});

test('keeps separate keys independent', async () => {
  const resultA = await cachedFetch('key-a', async () => 'A');
  const resultB = await cachedFetch('key-b', async () => 'B');

  assert.equal(resultA, 'A');
  assert.equal(resultB, 'B');
});

test('does not cache a rejected fetch, so the next call retries', async () => {
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('network error');
    }
    return 'recovered';
  };

  await assert.rejects(() => cachedFetch('key-4', fetcher, 60_000));
  const result = await cachedFetch('key-4', fetcher, 60_000);

  assert.equal(result, 'recovered');
  assert.equal(calls, 2);
});
