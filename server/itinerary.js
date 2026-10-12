import OpenAI from 'openai';

const LIMITS = Object.freeze({
  days: 7,
  places: 12,
  placeId: 220,
  short: 160,
  address: 300,
  openingInfo: 240,
});

const text = (value, max = LIMITS.short) => String(value ?? '').trim().slice(0, max);
const array = (value) => (Array.isArray(value) ? value : []);

function coordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function cleanPreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const interests = array(value.interests).slice(0, 10).map((item) => text(item, 60)).filter(Boolean);
  return {
    interests,
    budget: text(value.budget, 60),
    pace: text(value.pace, 60),
  };
}

export function cleanItineraryPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('The request body must be a JSON object.'), { status: 400, publicMessage: 'That itinerary request was not formatted correctly.' });
  }

  const seen = new Set();
  const places = array(body.places).slice(0, LIMITS.places).map((place) => ({
    placeId: text(place?.placeId ?? place?.id, LIMITS.placeId),
    name: text(place?.name),
    destination: text(place?.destination),
    category: text(place?.category, 80),
    address: text(place?.address, LIMITS.address),
    rating: text(place?.rating, 20),
    openingInfo: text(place?.openingText, LIMITS.openingInfo),
    coordinates: coordinates(place?.coordinates),
  })).filter((place) => {
    if (!place.placeId || !place.name || seen.has(place.placeId)) return false;
    seen.add(place.placeId);
    return true;
  });

  if (places.length < 2) {
    throw Object.assign(new Error('At least two verified places are required.'), { status: 400, publicMessage: 'Save at least two places before building an itinerary.' });
  }

  const dayCount = Math.min(LIMITS.days, Math.max(1, Number.parseInt(body.dayCount, 10) || 1));
  const pace = ['relaxed', 'balanced', 'full'].includes(body.pace) ? body.pace : 'balanced';
  const stay = body.stay && typeof body.stay === 'object' && !Array.isArray(body.stay)
    ? {
      name: text(body.stay.name),
      address: text(body.stay.address, LIMITS.address),
      coordinates: coordinates(body.stay.coordinates),
    }
    : null;

  return {
    dayCount,
    pace,
    destination: text(body.destination, LIMITS.short),
    dates: {
      start: text(body.dates?.start, 20),
      end: text(body.dates?.end, 20),
    },
    stay: stay?.name || stay?.address || stay?.coordinates ? stay : null,
    preferences: cleanPreferences(body.preferences),
    places,
  };
}

export const itinerarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    days: {
      type: 'array',
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'integer' },
          title: { type: 'string' },
          note: { type: 'string' },
          stops: {
            type: 'array',
            maxItems: 8,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                placeId: { type: 'string' },
                timeOfDay: { type: 'string', enum: ['Morning', 'Afternoon', 'Evening'] },
                reason: { type: 'string' },
              },
              required: ['placeId', 'timeOfDay', 'reason'],
            },
          },
        },
        required: ['day', 'title', 'note', 'stops'],
      },
    },
  },
  required: ['title', 'summary', 'days'],
};

const itineraryInstructions = `You are WhereTo's itinerary editor. Arrange the traveler's saved, verified Google Places into a practical itinerary.

Rules:
- Use every supplied place exactly once and never add a place that is not supplied.
- Copy each supplied placeId exactly. Never invent an ID, place, price, opening hour, or travel time.
- Group nearby coordinates on the same day when practical.
- Respect the requested day count and pace. Relaxed means fewer stops per day; full means more, but do not exceed the supplied places.
- Use opening information only when it is supplied. Do not claim a place is open at a specific time otherwise.
- Consider the stay as a useful home base, not as a required first stop.
- Keep each day title specific and each note and stop reason to one brief sentence.
- Return only the requested structured response.`;

function timeForPosition(index, total) {
  if (total <= 2) return index === 0 ? 'Morning' : 'Afternoon';
  if (index === 0) return 'Morning';
  if (index === total - 1) return 'Evening';
  return 'Afternoon';
}

export function validateItineraryResult(value, payload, now = new Date()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The itinerary response was not an object.');

  const candidates = new Map(payload.places.map((place) => [place.placeId, place]));
  const used = new Set();
  const days = Array.from({ length: payload.dayCount }, (_, index) => ({
    day: index + 1,
    title: `Day ${index + 1}`,
    note: '',
    stops: [],
  }));

  for (const rawDay of array(value.days).slice(0, payload.dayCount)) {
    const dayNumber = Math.min(payload.dayCount, Math.max(1, Number.parseInt(rawDay?.day, 10) || 1));
    const day = days[dayNumber - 1];
    day.title = text(rawDay?.title, 120) || day.title;
    day.note = text(rawDay?.note, 240);
    for (const rawStop of array(rawDay?.stops).slice(0, 8)) {
      const placeId = text(rawStop?.placeId, LIMITS.placeId);
      if (!candidates.has(placeId) || used.has(placeId)) continue;
      used.add(placeId);
      day.stops.push({
        placeId,
        timeOfDay: ['Morning', 'Afternoon', 'Evening'].includes(rawStop?.timeOfDay) ? rawStop.timeOfDay : 'Afternoon',
        reason: text(rawStop?.reason, 220) || 'One of the places you saved for this trip.',
      });
    }
  }

  for (const place of payload.places) {
    if (used.has(place.placeId)) continue;
    const day = days.reduce((shortest, candidate) => (candidate.stops.length < shortest.stops.length ? candidate : shortest), days[0]);
    day.stops.push({ placeId: place.placeId, timeOfDay: 'Afternoon', reason: 'One of the places you saved for this trip.' });
    used.add(place.placeId);
  }

  days.forEach((day) => {
    day.stops.forEach((stop, index) => {
      if (!['Morning', 'Afternoon', 'Evening'].includes(stop.timeOfDay)) stop.timeOfDay = timeForPosition(index, day.stops.length);
    });
    if (!day.note) day.note = day.stops.length ? 'A simple route through the places you saved.' : 'Keep this day open for a slower pace or a new discovery.';
  });

  return {
    version: 1,
    title: text(value.title, 140) || `${payload.dayCount}-day ${payload.destination || 'trip'} itinerary`,
    summary: text(value.summary, 360) || 'Your saved places, arranged into a practical starting point.',
    pace: payload.pace,
    dayCount: payload.dayCount,
    days,
    generatedAt: now.toISOString(),
  };
}

export function createItineraryService({ apiKey, model, timeoutMs = 30_000, client: suppliedClient } = {}) {
  const client = suppliedClient ?? (apiKey ? new OpenAI({ apiKey }) : null);

  return {
    configured: Boolean(client),
    model,
    async generate(payload) {
      if (!client) throw Object.assign(new Error('OpenAI is not configured.'), { code: 'AI_NOT_CONFIGURED' });

      const response = await client.responses.create({
        model,
        store: false,
        max_output_tokens: 1_200,
        instructions: itineraryInstructions,
        input: [{ role: 'developer', content: `Current verified Trip data: ${JSON.stringify(payload)}` }],
        text: { format: { type: 'json_schema', name: 'whereto_trip_itinerary', strict: true, schema: itinerarySchema } },
      }, { timeout: timeoutMs, maxRetries: 1 });

      if (response.status !== 'completed' || !response.output_text) {
        const reason = response.incomplete_details?.reason ?? response.status ?? 'missing_output';
        throw Object.assign(new Error(`Incomplete OpenAI response: ${reason}`), { code: 'AI_RESPONSE_INCOMPLETE', upstreamRequestId: response._request_id });
      }

      let parsed;
      try {
        parsed = JSON.parse(response.output_text);
      } catch {
        throw Object.assign(new Error('OpenAI returned invalid JSON.'), { code: 'AI_RESPONSE_INVALID', upstreamRequestId: response._request_id });
      }

      try {
        return { result: validateItineraryResult(parsed, payload), upstreamRequestId: response._request_id };
      } catch (error) {
        throw Object.assign(new Error(`OpenAI returned an invalid itinerary: ${error.message}`), { code: 'AI_RESPONSE_INVALID', upstreamRequestId: response._request_id });
      }
    },
  };
}
