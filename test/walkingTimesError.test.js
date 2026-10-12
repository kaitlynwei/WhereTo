import test from 'node:test';
import assert from 'node:assert/strict';
import { walkingTimesErrorMessage } from '../src/lib/walkingTimes.js';

test('walking-time permission failures explain the API-key restriction', () => {
  const message = walkingTimesErrorMessage(new Error('API_KEY_SERVICE_BLOCKED: Routes API request blocked'));
  assert.match(message, /Routes is not allowed on this API key/);
});

test('walking-time timeouts preserve the direct-distance fallback', () => {
  const message = walkingTimesErrorMessage(new Error('Walking times took too long to respond.'));
  assert.match(message, /too long to load/);
  assert.match(message, /direct distance/);
});
