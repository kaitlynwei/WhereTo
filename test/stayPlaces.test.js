import test from 'node:test';
import assert from 'node:assert/strict';
import { isStayPlaceCandidate } from '../src/lib/googleMaps.js';

test('stay search accepts lodging, addresses, and neighborhoods', () => {
  assert.equal(isStayPlaceCandidate({ primaryType: 'hotel', primaryTypeDisplayName: 'Hotel' }), true);
  assert.equal(isStayPlaceCandidate({ primaryType: 'street_address', primaryTypeDisplayName: 'Address' }), true);
  assert.equal(isStayPlaceCandidate({ primaryType: 'neighborhood', primaryTypeDisplayName: 'Neighborhood' }), true);
});

test('stay search rejects restaurants and stores', () => {
  assert.equal(isStayPlaceCandidate({ primaryType: 'restaurant', primaryTypeDisplayName: 'Hot Pot Restaurant' }), false);
  assert.equal(isStayPlaceCandidate({ primaryType: 'clothing_store', primaryTypeDisplayName: 'Clothing Store' }), false);
  assert.equal(isStayPlaceCandidate({ primaryType: 'tourist_attraction', primaryTypeDisplayName: 'Tourist Attraction' }), false);
});
