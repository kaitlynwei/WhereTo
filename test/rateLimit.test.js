import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../server/rateLimit.js';

test('rate limiter blocks excess requests and resets after its window', () => {
  let currentTime = 1_000;
  const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1_000, now: () => currentTime });

  assert.equal(limiter.check('visitor').allowed, true);
  assert.equal(limiter.check('visitor').allowed, true);
  const blocked = limiter.check('visitor');
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);

  currentTime = 2_001;
  assert.equal(limiter.check('visitor').allowed, true);
});
