import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseTripForDestination,
  DEFAULT_TRIP_PREFERENCES,
  mergeTripDestinations,
  newTripRecord,
  tripContainsDestination,
  tripIdForDestination,
  tripRemovalPlan,
  tripStay,
  tripTitle,
} from '../src/lib/trips.js';

test('a new trip exposes the fields future itinerary features will use', () => {
  const trip = newTripRecord();
  assert.equal(trip.id, 'current');
  assert.deepEqual(trip.destinations, []);
  assert.deepEqual(trip.dates, { start: null, end: null });
  assert.equal(trip.stay, null);
  assert.deepEqual(trip.preferences, DEFAULT_TRIP_PREFERENCES);
  assert.equal(trip.itinerary, null);
});

test('trip destinations are normalized and deduplicated', () => {
  const destinations = mergeTripDestinations(
    [{ id: 'florence', name: 'Florence', country: 'Italy' }],
    [{ destinationId: 'florence', destination: 'Florence' }, { name: 'Tokyo', country: 'Japan' }],
  );
  assert.equal(destinations.length, 2);
  assert.deepEqual(destinations.map((destination) => destination.id), ['florence', 'tokyo']);
});

test('a trip stay keeps the Google Place id and useful map fields', () => {
  const stay = tripStay({
    id: 'hotel-place-id',
    name: 'Hotel Example',
    address: '1 Via Roma',
    coordinates: { lat: 43.77, lng: 11.25 },
  }, { id: 'florence', name: 'Florence' });
  assert.deepEqual(stay, {
    placeId: 'hotel-place-id',
    destinationId: 'florence',
    destination: 'Florence',
    name: 'Hotel Example',
    address: '1 Via Roma',
    coordinates: { lat: 43.77, lng: 11.25 },
  });
});

test('new destinations receive stable separate trip ids', () => {
  assert.equal(tripIdForDestination({ id: 'paris', name: 'Paris' }), 'trip-paris');
  assert.equal(tripTitle([{ id: 'paris', name: 'Paris' }]), 'Paris trip');
  assert.equal(tripTitle([{ id: 'paris', name: 'Paris' }, { id: 'versailles', name: 'Versailles' }]), 'Paris + Versailles');
});

test('destination actions prefer the active joint trip', () => {
  const separate = { id: 'trip-versailles', destinations: [{ id: 'versailles', name: 'Versailles' }] };
  const joint = { id: 'current', destinations: [{ id: 'paris', name: 'Paris' }, { id: 'versailles', name: 'Versailles' }] };
  assert.equal(tripContainsDestination(joint, 'versailles'), true);
  assert.equal(chooseTripForDestination([separate, joint], 'versailles', 'current')?.id, 'current');
  assert.equal(chooseTripForDestination([separate, joint], 'versailles', '')?.id, 'trip-versailles');
});

test('removing one trip selects a different existing trip', () => {
  const plan = tripRemovalPlan([
    { id: 'current', title: 'Paris trip' },
    { id: 'trip-new-york', title: 'New York trip' },
  ], 'current');
  assert.equal(plan.resetToBlankTrip, false);
  assert.equal(plan.nextTripId, 'trip-new-york');
  assert.deepEqual(plan.remainingTrips.map((trip) => trip.id), ['trip-new-york']);
});

test('removing the final trip leaves a blank workspace instead of restoring it', () => {
  const plan = tripRemovalPlan([{ id: 'current', title: 'Paris trip' }], 'current');
  assert.equal(plan.resetToBlankTrip, true);
  assert.equal(plan.nextTripId, 'current');
  assert.deepEqual(plan.remainingTrips, []);
});
