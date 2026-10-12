import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdvisorService } from '../server/advisor.js';
import { cleanAdvisorPayload } from '../server/validation.js';

test('advisor service replaces invented Place IDs with grounded candidates', async () => {
  const client = {
    responses: {
      create: async () => ({
        status: 'completed',
        output_text: JSON.stringify({
          reply: 'Here are two ideas.',
          stage: 'activities',
          followUpQuestions: [],
          destinations: [],
          neighborhoods: [],
          placeRecommendations: [
            { placeId: 'fake-place', reason: 'Invented' },
            { placeId: 'google-place-1', reason: 'Verified candidate' },
          ],
          suggestedCategory: 'For you',
        }),
        _request_id: 'upstream-test-id',
      }),
    },
  };
  const advisor = createAdvisorService({ client, model: 'test-model' });
  const payload = cleanAdvisorPayload({
    mode: 'destination',
    destination: 'Barcelona',
    messages: [{ role: 'user', content: 'Something local' }],
    places: [{ id: 'google-place-1', name: 'Real candidate' }],
  });
  const response = await advisor.respond(payload);
  assert.equal(response.upstreamRequestId, 'upstream-test-id');
  assert.deepEqual(response.result.placeRecommendations, [{
    placeId: 'google-place-1',
    reason: 'A verified live Google place matching your request.',
  }]);
  assert.match(response.result.reply, /verified options/i);
});

test('advisor service identifies incomplete upstream responses', async () => {
  const client = { responses: { create: async () => ({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }) } };
  const advisor = createAdvisorService({ client, model: 'test-model' });
  await assert.rejects(
    advisor.respond(cleanAdvisorPayload({ messages: [{ role: 'user', content: 'Help' }] })),
    (error) => error.code === 'AI_RESPONSE_INCOMPLETE',
  );
});
