import test from 'node:test';
import assert from 'node:assert/strict';
import {
  balancedDestinationSelection,
  dailyDestinationSelection,
  discoveryDestinationDeck,
  rankDestinations,
} from '../src/lib/destinationDiscovery.js';

const destinations = [
  { id: 'big-city', name: 'Big City', categories: ['Food'], discoveryGroup: 'iconic', underTheRadar: false, price: '$$$', weather: ['Warm'], paces: ['Balanced'] },
  { id: 'coastal-hit', name: 'Coastal Hit', categories: ['Beach', 'Relaxation'], discoveryGroup: 'trending', underTheRadar: false, price: '$$', weather: ['Warm'], paces: ['Slow'] },
  { id: 'quiet-coast', name: 'Quiet Coast', categories: ['Beach', 'Relaxation'], discoveryGroup: 'distinctive', underTheRadar: true, price: '$$', weather: ['Warm'], paces: ['Slow'] },
  { id: 'mountain-town', name: 'Mountain Town', categories: ['Nature', 'Adventure'], discoveryGroup: 'distinctive', underTheRadar: true, price: '$$', weather: ['Cool'], paces: ['Balanced'] },
  { id: 'small-city', name: 'Small City', categories: ['Food', 'Culture'], discoveryGroup: 'trending', underTheRadar: false, price: '$$', weather: ['Warm'], paces: ['Balanced'] },
];

test('not-interested destinations move to the bottom without disappearing', () => {
  const ranked = rankDestinations(destinations, {
    preferences: [{ id: 'quiet-coast', signal: 'not-interested', categories: ['Beach', 'Relaxation'] }],
    date: new Date('2026-10-04T12:00:00'),
  });
  assert.equal(ranked.length, destinations.length);
  assert.equal(ranked.at(-1).id, 'quiet-coast');
});

test('interested destinations and similar categories rank higher', () => {
  const ranked = rankDestinations(destinations, {
    preferences: [{ id: 'small-city', signal: 'interested', categories: ['Food', 'Culture'] }],
    date: new Date('2026-10-04T12:00:00'),
  });
  assert.equal(ranked[0].id, 'small-city');
  assert.ok(ranked.findIndex((item) => item.id === 'big-city') < ranked.findIndex((item) => item.id === 'quiet-coast'));
});

test('daily homepage selection is stable and balances iconic, trending, and distinctive destinations', () => {
  const first = dailyDestinationSelection(destinations, { count: 3, date: new Date('2026-10-04T09:00:00') });
  const second = dailyDestinationSelection(destinations, { count: 3, date: new Date('2026-10-04T22:00:00') });
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  assert.deepEqual(new Set(first.map((item) => item.discoveryGroup)), new Set(['iconic', 'trending', 'distinctive']));
});

test('balanced discovery grid keeps recognizable, trending, and distinctive places in view', () => {
  const selected = balancedDestinationSelection(destinations, { count: 5, date: new Date('2026-10-04T12:00:00') });
  assert.equal(selected.length, 5);
  assert.ok(selected.some((item) => item.discoveryGroup === 'iconic'));
  assert.ok(selected.some((item) => item.discoveryGroup === 'trending'));
  assert.ok(selected.some((item) => item.discoveryGroup === 'distinctive'));
});

test('daily homepage selection rotates to a different set on a new day', () => {
  const first = dailyDestinationSelection(destinations, { count: 3, date: new Date('2026-10-04T12:00:00') });
  const next = dailyDestinationSelection(destinations, { count: 3, date: new Date('2026-10-05T12:00:00') });
  assert.notDeepEqual(first.map((item) => item.id), next.map((item) => item.id));
});

test('the discovery deck reshuffles while keeping explicit preferences meaningful', () => {
  const options = {
    preferences: [
      { id: 'small-city', signal: 'interested', categories: ['Food', 'Culture'] },
      { id: 'quiet-coast', signal: 'not-interested', categories: ['Beach', 'Relaxation'] },
    ],
    date: new Date('2026-10-04T12:00:00'),
  };
  const first = discoveryDestinationDeck(destinations, { ...options, shuffleKey: 1 });
  assert.equal(first[0].id, 'small-city');
  assert.equal(first.at(-1).id, 'quiet-coast');

  const evenCandidates = destinations.map((destination) => ({
    ...destination, categories: [], discoveryGroup: 'trending', underTheRadar: false,
  }));
  const shuffledOnce = discoveryDestinationDeck(evenCandidates, { shuffleKey: 1, date: options.date });
  const shuffledAgain = discoveryDestinationDeck(evenCandidates, { shuffleKey: 2, date: options.date });
  assert.notDeepEqual(shuffledOnce.map((item) => item.id), shuffledAgain.map((item) => item.id));
});
