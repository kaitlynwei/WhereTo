import { destinations } from './destinations.js';
import { recommendations } from './prototypeData.js';
import { destinationSlug } from '../lib/navigation.js';

const existingDescriptions = {
  'new-york': 'Big energy, small neighborhoods, and more good reasons to walk than any itinerary can hold.',
};

const destinationRecords = new Map();

destinations.forEach((destination) => {
  const id = destinationSlug(destination.name);
  destinationRecords.set(id, {
    id,
    displayName: destination.name === 'New York' ? 'New York City' : destination.name,
    name: destination.name,
    country: destination.country,
    image: destination.image,
    categories: destination.categories,
    description: existingDescriptions[id],
    highlights: [],
  });
});

recommendations.forEach((recommendation) => {
  const id = recommendation.id || destinationSlug(recommendation.name);
  const current = destinationRecords.get(id) ?? {};
  destinationRecords.set(id, {
    ...current,
    ...recommendation,
    id,
    displayName: recommendation.name,
    highlights: recommendation.experiences,
  });
});

export const destinationGuides = Array.from(destinationRecords.values()).map((guide) => ({
  ...guide,
  description: guide.description ?? `A visual starting point for ${guide.categories.slice(0, 3).join(', ').toLowerCase()}, and the places that give the trip its character.`,
}));

const destinationAliases = {
  nyc: 'new-york',
  'new-york-city': 'new-york',
};

export function getDestinationGuide(value = 'new-york') {
  const normalized = destinationSlug(value);
  const id = destinationAliases[normalized] ?? normalized;
  return destinationGuides.find((guide) => guide.id === id) ?? destinationGuides.find((guide) => guide.id === 'new-york');
}

export function findDestinationGuide(value) {
  if (!value.trim()) return null;
  const normalized = destinationSlug(value);
  const id = destinationAliases[normalized] ?? normalized;
  return destinationGuides.find((guide) => guide.id === id) ?? null;
}
