import test from 'node:test';
import assert from 'node:assert/strict';
import { localDestinationSuggestions, mergeDestinationSuggestions } from '../src/lib/destinationAutocomplete.js';
import { serializeDestinationPrediction } from '../src/lib/googleMaps.js';

test('destination autocomplete keeps distinct city and region labels', () => {
  const suggestion = serializeDestinationPrediction({
    placeId: 'new-york-id',
    mainText: { toString: () => 'New York' },
    secondaryText: { toString: () => 'NY, USA' },
    text: { toString: () => 'New York, NY, USA' },
  });
  assert.deepEqual({
    id: suggestion.id,
    name: suggestion.name,
    secondaryText: suggestion.secondaryText,
    fullText: suggestion.fullText,
  }, {
    id: 'new-york-id',
    name: 'New York',
    secondaryText: 'NY, USA',
    fullText: 'New York, NY, USA',
  });
});

test('typing an acronym like ny immediately finds New York', () => {
  const suggestions = localDestinationSuggestions('ny');
  assert.equal(suggestions[0].name, 'New York');
});

test('live and local city suggestions are merged without duplicates', () => {
  const local = localDestinationSuggestions('tok');
  const merged = mergeDestinationSuggestions([
    { id: 'google-tokyo', name: 'Tokyo', secondaryText: 'Japan' },
  ], local);
  assert.equal(merged.filter((suggestion) => suggestion.name === 'Tokyo').length, 1);
});
