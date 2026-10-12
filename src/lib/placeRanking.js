const interestTerms = {
  Food: ['food', 'restaurant', 'cafe', 'bakery', 'market', 'bar', 'meal'],
  Culture: ['culture', 'museum', 'gallery', 'art', 'historic', 'landmark', 'architecture', 'temple', 'church'],
  Museums: ['museum', 'gallery', 'exhibit'],
  Nature: ['nature', 'park', 'garden', 'beach', 'trail', 'outdoor'],
  Adventure: ['adventure', 'hike', 'trail', 'climb', 'sport', 'outdoor'],
  Beach: ['beach', 'coast', 'island', 'waterfront'],
  Nightlife: ['nightlife', 'bar', 'club', 'music', 'entertainment'],
  Shopping: ['shopping', 'shop', 'market', 'store', 'mall'],
  Relaxation: ['spa', 'garden', 'park', 'beach', 'wellness'],
};

function clamp(value, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function qualityScore(place) {
  const rating = Number(place.rating);
  const reviews = Number(place.userRatingCount);
  const ratingScore = Number.isFinite(rating) ? clamp((rating - 3) / 2) : 0;
  const popularityScore = Number.isFinite(reviews) ? clamp(Math.log10(reviews + 1) / 5) : 0;
  return (ratingScore * 0.55) + (popularityScore * 0.45);
}

export function reviewCountLabel(count) {
  const reviews = Number(count);
  if (!Number.isFinite(reviews) || reviews <= 0) return '';
  return `${new Intl.NumberFormat('en', {
    notation: reviews >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: reviews >= 1000 ? 1 : 0,
  }).format(reviews)} reviews`;
}

function interestScore(place, interests = []) {
  if (!interests.length) return 0.5;
  const text = [place.name, place.category, place.guideCategory, place.description]
    .filter(Boolean).join(' ').toLowerCase();
  const matches = interests.filter((interest) => {
    const terms = interestTerms[interest] ?? [String(interest).toLowerCase()];
    return terms.some((term) => text.includes(term.toLowerCase()));
  }).length;
  return clamp(matches / Math.min(2, interests.length));
}

function proximityScore(place) {
  const minutes = Number(place.walkingMinutes);
  if (Number.isFinite(minutes)) return clamp(1 - ((minutes - 8) / 82));
  const miles = Number(place.distanceMiles);
  if (Number.isFinite(miles)) return clamp(1 - (miles / 6));
  return 0;
}

function proximityValue(place) {
  const minutes = Number(place.walkingMinutes);
  if (Number.isFinite(minutes)) return minutes;
  const miles = Number(place.distanceMiles);
  return Number.isFinite(miles) ? miles * 20 : Number.POSITIVE_INFINITY;
}

export function scoreDestinationPlace(place, { tripPreferences = {}, hasStay = false } = {}) {
  const interests = tripPreferences.interests ?? [];
  const interest = interestScore(place, interests);
  const quality = qualityScore(place);
  const proximity = hasStay ? proximityScore(place) : 0;
  const recommendationBoost = place.aiReason ? 4 : 0;
  return hasStay
    ? (interest * 25) + (quality * 60) + (proximity * 15) + recommendationBoost
    : (interest * 25) + (quality * 75) + recommendationBoost;
}

export function rankDestinationPlaces(places, {
  tripPreferences = {},
  hasStay = false,
} = {}) {
  return places.map((place, index) => ({
    ...place,
    matchScore: scoreDestinationPlace(place, { tripPreferences, hasStay }),
    _sourceIndex: index,
  })).sort((left, right) => (
    right.matchScore - left.matchScore
    || qualityScore(right) - qualityScore(left)
    || proximityValue(left) - proximityValue(right)
    || left._sourceIndex - right._sourceIndex
  )).map(({ _sourceIndex, ...place }) => place);
}
