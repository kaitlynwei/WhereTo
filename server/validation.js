const LIMITS = Object.freeze({
  destination: 120,
  message: 1_500,
  messages: 12,
  places: 20,
  placeId: 220,
  short: 120,
  address: 260,
  preferences: 10,
});

const text = (value, max = LIMITS.short) => String(value ?? '').trim().slice(0, max);

function cleanPreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const allowedKeys = ['interests', 'budget', 'weather', 'pace'];
  const cleaned = {};

  for (const key of allowedKeys) {
    if (!(key in value)) continue;
    if (key === 'interests') {
      cleaned.interests = Array.isArray(value.interests)
        ? value.interests.slice(0, LIMITS.preferences).map((item) => text(item, 60)).filter(Boolean)
        : [];
    } else {
      cleaned[key] = text(value[key], 60);
    }
  }
  return Object.keys(cleaned).length ? cleaned : null;
}

export function cleanAdvisorPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('The request body must be a JSON object.'), { status: 400, publicMessage: 'That request was not formatted correctly.' });
  }

  const messages = Array.isArray(body.messages)
    ? body.messages.slice(-LIMITS.messages).map((message) => ({
      role: message?.role === 'assistant' ? 'assistant' : 'user',
      content: text(message?.content, LIMITS.message),
    })).filter((message) => message.content)
    : [];

  if (!messages.length || messages.at(-1)?.role !== 'user') {
    throw Object.assign(new Error('A final user message is required.'), { status: 400, publicMessage: 'Tell WhereTo what kind of trip or place you want.' });
  }

  const seenIds = new Set();
  const places = (Array.isArray(body.places) ? body.places : []).slice(0, LIMITS.places).map((place) => ({
    placeId: text(place?.id ?? place?.placeId, LIMITS.placeId),
    name: text(place?.name),
    category: text(place?.category, 80),
    rating: text(place?.rating, 12),
    price: text(place?.price, 20),
    address: text(place?.address, LIMITS.address),
    distance: text(place?.distance, 80),
    openingInfo: text(place?.openingText, 220),
  })).filter((place) => {
    if (!place.placeId || seenIds.has(place.placeId)) return false;
    seenIds.add(place.placeId);
    return true;
  });

  const stay = body.stay && typeof body.stay === 'object' && !Array.isArray(body.stay)
    ? { name: text(body.stay.name, 160), address: text(body.stay.address, LIMITS.address) }
    : null;

  return {
    mode: body.mode === 'destination' ? 'destination' : 'discovery',
    destination: text(body.destination, LIMITS.destination),
    stay: stay?.name || stay?.address ? stay : null,
    preferences: cleanPreferences(body.preferences),
    messages,
    places,
  };
}

const array = (value) => (Array.isArray(value) ? value : []);

export function validateAdvisorResult(value, payload) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The AI response was not an object.');

  const validStages = new Set(['clarify', 'destinations', 'activities', 'stay']);
  const validCategories = new Set(['Top things to do', 'Food & drink', 'Culture', 'Outdoors', 'Shopping', 'For you']);
  const candidatesById = new Map(payload.places.map((place) => [place.placeId, place]));
  const candidateIds = new Set(payload.places.map((place) => place.placeId));
  const recommendedIds = new Set();
  const rawPlaceRecommendations = array(value.placeRecommendations).slice(0, 8);
  const hasUnknownPlaceId = payload.mode === 'destination'
    && rawPlaceRecommendations.some((item) => !candidateIds.has(text(item?.placeId, LIMITS.placeId)));

  let placeRecommendations = payload.mode === 'destination'
    ? rawPlaceRecommendations.map((item) => ({
      placeId: text(item?.placeId, LIMITS.placeId),
      reason: text(item?.reason, 320),
    })).filter((item) => {
      if (!candidateIds.has(item.placeId) || recommendedIds.has(item.placeId) || !item.reason) return false;
      recommendedIds.add(item.placeId);
      return true;
    }).map((item) => {
      const candidate = candidatesById.get(item.placeId);
      const details = [candidate?.category, candidate?.rating ? `rated ${candidate.rating}` : '', candidate?.price, candidate?.distance]
        .filter(Boolean)
        .join(' · ');
      return {
        placeId: item.placeId,
        reason: details ? `A verified Google place matching your request: ${details}.` : 'A verified live Google place matching your request.',
      };
    })
    : [];

  if (hasUnknownPlaceId && placeRecommendations.length === 0) {
    placeRecommendations = payload.places.slice(0, 4).map((place) => ({
      placeId: place.placeId,
      reason: 'A verified live option that matches the kind of place you described.',
    }));
  }

  const destinations = payload.mode === 'discovery'
    ? array(value.destinations).slice(0, 3).map((item) => ({
      name: text(item?.name),
      country: text(item?.country, 80),
      reason: text(item?.reason, 320),
      consideration: text(item?.consideration, 240),
      tags: array(item?.tags).slice(0, 4).map((tag) => text(tag, 40)).filter(Boolean),
    })).filter((item) => item.name && item.country && item.reason)
    : [];

  const neighborhoods = payload.mode === 'destination'
    ? array(value.neighborhoods).slice(0, 4).map((item) => ({
      name: text(item?.name),
      reason: text(item?.reason, 320),
      bestFor: text(item?.bestFor, 120),
      tradeoff: text(item?.tradeoff, 240),
    })).filter((item) => item.name && item.reason)
    : [];

  const reply = placeRecommendations.length
    ? 'I found a few verified options from the live Google places available for this destination.'
    : text(value.reply, 1_200);
  if (!reply) throw new Error('The AI response did not contain a reply.');

  return {
    reply,
    stage: validStages.has(value.stage) ? value.stage : (payload.mode === 'destination' ? 'activities' : 'clarify'),
    followUpQuestions: array(value.followUpQuestions).slice(0, 3).map((question) => text(question, 240)).filter(Boolean),
    destinations,
    neighborhoods,
    placeRecommendations,
    suggestedCategory: validCategories.has(value.suggestedCategory) ? value.suggestedCategory : 'For you',
  };
}
