import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanItineraryPayload,
  createItineraryService,
  validateItineraryResult,
} from '../server/itinerary.js';

const rawTrip = {
  dayCount: 2,
  pace: 'relaxed',
  destination: 'Florence',
  stay: { name: 'Santo Spirito', coordinates: { lat: 43.766, lng: 11.248 } },
  preferences: { interests: ['Food', 'Art'] },
  places: [
    { id: 'place-1', name: 'Uffizi Gallery', category: 'Museum', coordinates: { lat: 43.7687, lng: 11.2556 } },
    { id: 'place-2', name: 'Boboli Gardens', category: 'Garden', coordinates: { lat: 43.7629, lng: 11.2486 } },
    { id: 'place-3', name: 'Mercato Centrale', category: 'Market', coordinates: { lat: 43.7767, lng: 11.2536 } },
  ],
};

test('itinerary input is bounded and requires real saved places', () => {
  const cleaned = cleanItineraryPayload({ ...rawTrip, dayCount: 99, pace: 'impossible' });
  assert.equal(cleaned.dayCount, 7);
  assert.equal(cleaned.pace, 'balanced');
  assert.equal(cleaned.places.length, 3);
  assert.throws(
    () => cleanItineraryPayload({ places: [{ id: 'one', name: 'Only one' }] }),
    /At least two verified places/,
  );
});

test('itinerary validation rejects invented IDs and still schedules every verified place', () => {
  const payload = cleanItineraryPayload(rawTrip);
  const result = validateItineraryResult({
    title: 'Florence at an easy pace',
    summary: 'Two practical days.',
    days: [
      { day: 1, title: 'Art and markets', note: 'Stay central.', stops: [
        { placeId: 'fake-place', timeOfDay: 'Morning', reason: 'Invented' },
        { placeId: 'place-1', timeOfDay: 'Afternoon', reason: 'A saved highlight.' },
      ] },
      { day: 2, title: 'Across the river', note: 'A garden day.', stops: [] },
    ],
  }, payload, new Date('2026-10-11T12:00:00.000Z'));

  const ids = result.days.flatMap((day) => day.stops.map((stop) => stop.placeId));
  assert.deepEqual(new Set(ids), new Set(['place-1', 'place-2', 'place-3']));
  assert.equal(ids.includes('fake-place'), false);
  assert.equal(result.generatedAt, '2026-10-11T12:00:00.000Z');
});

test('itinerary service uses a strict structured response', async () => {
  let request;
  const client = { responses: { create: async (value) => {
    request = value;
    return {
      status: 'completed',
      output_text: JSON.stringify({
        title: 'Two days in Florence',
        summary: 'A concise plan.',
        days: [
          { day: 1, title: 'Center', note: 'Art first.', stops: [{ placeId: 'place-1', timeOfDay: 'Morning', reason: 'Start here.' }] },
          { day: 2, title: 'Oltrarno', note: 'A slower day.', stops: [{ placeId: 'place-2', timeOfDay: 'Morning', reason: 'Nearby.' }, { placeId: 'place-3', timeOfDay: 'Evening', reason: 'Finish with food.' }] },
        ],
      }),
      _request_id: 'itinerary-test',
    };
  } } };
  const service = createItineraryService({ client, model: 'test-model' });
  const response = await service.generate(cleanItineraryPayload(rawTrip));
  assert.equal(request.store, false);
  assert.equal(request.text.format.strict, true);
  assert.equal(response.result.days.length, 2);
  assert.equal(response.upstreamRequestId, 'itinerary-test');
});
