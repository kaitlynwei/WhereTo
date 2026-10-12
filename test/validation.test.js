import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanAdvisorPayload, validateAdvisorResult } from '../server/validation.js';

test('advisor input keeps only supported, bounded fields', () => {
  const payload = cleanAdvisorPayload({
    mode: 'destination',
    destination: `New York${'x'.repeat(200)}`,
    preferences: { interests: ['Food', 'Culture'], budget: 'Comfortable', privateNote: 'discard me' },
    messages: [{ role: 'system', content: '  Find food  ' }],
    places: [
      { id: 'real-1', name: 'Cafe', secret: 'discard me' },
      { id: 'real-1', name: 'Duplicate' },
    ],
  });

  assert.equal(payload.mode, 'destination');
  assert.equal(payload.destination.length, 120);
  assert.deepEqual(payload.preferences, { interests: ['Food', 'Culture'], budget: 'Comfortable' });
  assert.deepEqual(payload.messages, [{ role: 'user', content: 'Find food' }]);
  assert.equal(payload.places.length, 1);
  assert.equal(payload.places[0].placeId, 'real-1');
  assert.equal('secret' in payload.places[0], false);
});

test('advisor input requires a final user message', () => {
  assert.throws(() => cleanAdvisorPayload({ messages: [{ role: 'assistant', content: 'Hello' }] }), /final user message/i);
});

test('unknown AI Place IDs are replaced with supplied Google candidates', () => {
  const payload = cleanAdvisorPayload({
    mode: 'destination',
    destination: 'Tokyo',
    messages: [{ role: 'user', content: 'Show me food' }],
    places: [{ id: 'real-1', name: 'Real place' }, { id: 'real-2', name: 'Other place' }],
  });
  const result = validateAdvisorResult({
    reply: 'Try these.', stage: 'activities', followUpQuestions: [], destinations: [], neighborhoods: [],
    placeRecommendations: [{ placeId: 'invented-id', reason: 'Not allowed' }],
    suggestedCategory: 'Food & drink',
  }, payload);
  assert.deepEqual(result.placeRecommendations.map((item) => item.placeId), ['real-1', 'real-2']);
  assert.match(result.reply, /verified options/i);
});
