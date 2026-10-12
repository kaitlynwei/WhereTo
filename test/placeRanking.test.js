import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeWalkingRoutes } from '../src/lib/googleMaps.js';
import { rankDestinationPlaces, reviewCountLabel } from '../src/lib/placeRanking.js';

const places = [
  { id: 'museum', name: 'City Art Museum', category: 'Art Museum', rating: '4.8', userRatingCount: 12000, walkingMinutes: 42 },
  { id: 'market', name: 'Old Food Market', category: 'Food Market', rating: '4.6', userRatingCount: 8000, walkingMinutes: 12 },
  { id: 'park', name: 'Riverside Park', category: 'Park', rating: '4.7', userRatingCount: 2100, walkingMinutes: 7 },
];

test('the default ranking combines interests, quality, popularity, and proximity', () => {
  const ranked = rankDestinationPlaces(places, {
    hasStay: true,
    tripPreferences: { interests: ['Food'] },
  });
  assert.equal(ranked[0].id, 'market');
});

test('a widely reviewed favorite outranks an obscure perfect score', () => {
  const ranked = rankDestinationPlaces([
    { id: 'favorite', rating: '4.8', userRatingCount: 18000 },
    { id: 'obscure', rating: '5.0', userRatingCount: 8 },
  ]);
  assert.equal(ranked[0].id, 'favorite');
});

test('review counts are compact and readable', () => {
  assert.equal(reviewCountLabel(12840), '12.8K reviews');
  assert.equal(reviewCountLabel(0), '');
});

test('changing the stay can change the first best-match result', () => {
  const candidates = [
    { id: 'a', name: 'Local Market A', category: 'Food Market', rating: '4.7', userRatingCount: 5000, walkingMinutes: 8 },
    { id: 'b', name: 'Local Market B', category: 'Food Market', rating: '4.7', userRatingCount: 5000, walkingMinutes: 38 },
  ];
  const first = rankDestinationPlaces(candidates, { hasStay: true, tripPreferences: { interests: ['Food'] } });
  const moved = rankDestinationPlaces(candidates.map((place) => ({
    ...place,
    walkingMinutes: place.id === 'a' ? 45 : 6,
  })), { hasStay: true, tripPreferences: { interests: ['Food'] } });
  assert.equal(first[0].id, 'a');
  assert.equal(moved[0].id, 'b');
});

test('walking route results become useful card labels and ranking data', () => {
  const routed = mergeWalkingRoutes(
    [{ id: 'a', coordinates: { lat: 40.7, lng: -74 }, name: 'A' }],
    [{ condition: 'ROUTE_EXISTS', durationMillis: 730000, distanceMeters: 910 }],
    { id: 'stay', coordinates: { lat: 40.71, lng: -74.01 } },
  );
  assert.equal(routed[0].distance, '12 min walk from your stay');
  assert.equal(routed[0].walkingMinutes, 12);
  assert.ok(routed[0].directionsHref.includes('travelmode=walking'));
});
