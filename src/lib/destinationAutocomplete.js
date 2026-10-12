import { destinationGuides } from '../data/destinationGuides.js';

function normalized(value = '') {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function matchScore(guide, query) {
  const name = normalized(guide.displayName || guide.name);
  const country = normalized(guide.country);
  const words = name.split(' ').filter(Boolean);
  const acronym = words.map((word) => word[0]).join('');
  if (name === query) return 100;
  if (name.startsWith(query)) return 90;
  if (acronym.startsWith(query)) return 85;
  if (words.some((word) => word.startsWith(query))) return 75;
  if (name.includes(query)) return 65;
  if (country.startsWith(query) || country.includes(query)) return 50;
  return 0;
}

export function localDestinationSuggestions(input, limit = 6) {
  const query = normalized(input);
  if (!query) return [];
  return destinationGuides
    .map((guide) => ({ guide, score: matchScore(guide, query) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.guide.name.localeCompare(right.guide.name))
    .slice(0, limit)
    .map(({ guide }) => ({
      id: `whereto-${guide.id}`,
      placeId: '',
      name: guide.displayName || guide.name,
      secondaryText: guide.country,
      fullText: [guide.displayName || guide.name, guide.country].filter(Boolean).join(', '),
      prediction: null,
      source: 'whereto',
    }));
}

export function mergeDestinationSuggestions(live = [], local = [], limit = 6) {
  const seen = new Set();
  return [...live, ...local].filter((suggestion) => {
    const key = normalized(suggestion.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}
