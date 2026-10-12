import { destinationSlug } from './navigation.js';

export const CURRENT_TRIP_ID = 'current';

export const DEFAULT_TRIP_PREFERENCES = {
  interests: ['Food', 'Culture'],
  budget: 'Comfortable',
  weather: 'Warm',
  pace: 'Balanced',
};

function compact(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => (
    value !== undefined && value !== ''
  )));
}

export function tripDestination(destination = {}) {
  const name = destination.displayName || destination.destination || destination.name || '';
  const id = destination.destinationId || destination.id || destinationSlug(name);
  return compact({
    id,
    name,
    country: destination.country || '',
  });
}

export function mergeTripDestinations(destinations = [], additions = []) {
  const records = new Map();
  [...destinations, ...additions].map(tripDestination).forEach((destination) => {
    if (destination.id && destination.name) records.set(destination.id, destination);
  });
  return Array.from(records.values()).slice(0, 20);
}

export function tripIdForDestination(destination = {}) {
  const normalized = tripDestination(destination);
  return `trip-${normalized.id || 'untitled'}`.slice(0, 120);
}

export function tripContainsDestination(trip, destinationId) {
  return Boolean(destinationId && trip?.destinations?.some((destination) => destination.id === destinationId));
}

export function tripTitle(destinations = []) {
  const names = mergeTripDestinations([], destinations).map((destination) => destination.name).filter(Boolean);
  if (!names.length) return 'My Trip';
  const title = names.length === 1
    ? `${names[0]} trip`
    : names.length === 2
      ? `${names[0]} + ${names[1]}`
      : `${names[0]} + ${names.length - 1} more`;
  return title.slice(0, 120);
}

export function chooseTripForDestination(trips = [], destinationId, activeTripId = '') {
  const activeTrip = trips.find((trip) => trip.id === activeTripId);
  if (tripContainsDestination(activeTrip, destinationId)) return activeTrip;
  return trips.find((trip) => tripContainsDestination(trip, destinationId)) ?? null;
}

export function tripRemovalPlan(trips = [], tripId = '') {
  const remainingTrips = trips.filter((trip) => trip.id !== tripId);
  return {
    remainingTrips,
    resetToBlankTrip: remainingTrips.length === 0,
    nextTripId: remainingTrips[0]?.id ?? CURRENT_TRIP_ID,
  };
}

export function tripStay(place, destination = {}) {
  if (!place) return null;
  const destinationRecord = tripDestination(destination);
  return compact({
    placeId: place.placeId || place.id,
    destinationId: destinationRecord.id || place.destinationId,
    destination: destinationRecord.name || place.destination,
    name: place.name,
    address: place.address || place.formattedAddress,
    coordinates: place.coordinates,
  });
}

export function newTripRecord({
  id = CURRENT_TRIP_ID,
  title,
  destinations = [],
  stay = null,
  preferences = DEFAULT_TRIP_PREFERENCES,
} = {}) {
  const normalizedDestinations = mergeTripDestinations([], destinations);
  return {
    id,
    title: title || tripTitle(normalizedDestinations),
    status: 'active',
    destinations: normalizedDestinations,
    dates: { start: null, end: null },
    stay,
    preferences: { ...DEFAULT_TRIP_PREFERENCES, ...preferences },
    itinerary: null,
    migrationVersion: 2,
  };
}
