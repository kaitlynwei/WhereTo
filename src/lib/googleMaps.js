const GOOGLE_MAPS_API_KEY = import.meta.env?.VITE_GOOGLE_MAPS_API_KEY?.trim();
const scriptId = 'whereto-google-maps';
const searchCache = new Map();
const promptSearchCache = new Map();
const staySearchCache = new Map();
const nearbyDestinationCache = new Map();
const neighborhoodPreviewCache = new Map();
const cityCache = new Map();
const placeCache = new Map();
const placeDetailsCache = new Map();
const walkingRouteCache = new Map();
const stayPlaceTypes = new Set([
  'hotel', 'lodging', 'hostel', 'motel', 'resort_hotel', 'bed_and_breakfast',
  'extended_stay_hotel', 'guest_house', 'inn', 'apartment_hotel',
  'apartment_building', 'condominium_complex', 'neighborhood', 'locality',
  'sublocality', 'street_address', 'premise', 'postal_code',
]);
const stayPlaceWords = /hotel|lodging|hostel|motel|resort|bed and breakfast|guest house|inn|apartment|address|neighborhood|locality/i;

const placeFields = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'primaryTypeDisplayName',
  'rating',
  'userRatingCount',
  'priceLevel',
  'regularOpeningHours',
  'utcOffsetMinutes',
  'photos',
  'businessStatus',
];

const categoryQueries = {
  'Top things to do': 'most popular highly rated attractions',
  'Food & drink': 'most popular highly rated restaurants and food markets',
  Culture: 'most popular highly rated museums and cultural attractions',
  Outdoors: 'most popular highly rated parks and outdoor attractions',
  Shopping: 'most popular highly rated shopping landmarks and stores',
};

const priceLabels = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
  FREE: 'Free',
  INEXPENSIVE: '$',
  MODERATE: '$$',
  EXPENSIVE: '$$$',
  VERY_EXPENSIVE: '$$$$',
};

let loaderPromise;

export const isGoogleMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY);

export function isStayPlaceCandidate(place) {
  return stayPlaceTypes.has(place?.primaryType)
    || stayPlaceWords.test(place?.primaryTypeDisplayName || '');
}

function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

export function serializeDestinationPrediction(prediction) {
  if (!prediction) return null;
  const name = prediction.mainText?.toString?.() || prediction.text?.toString?.() || '';
  const secondaryText = prediction.secondaryText?.toString?.() || '';
  return {
    id: prediction.placeId || `${name}-${secondaryText}`,
    placeId: prediction.placeId || '',
    name,
    secondaryText,
    fullText: prediction.text?.toString?.() || [name, secondaryText].filter(Boolean).join(', '),
    prediction,
  };
}

export function loadGoogleMaps() {
  if (!isGoogleMapsConfigured) {
    return Promise.reject(new Error('Google Places needs an API key before live places can load.'));
  }
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const callbackName = '__whereToGoogleMapsReady';
    const timeout = window.setTimeout(() => {
      reject(new Error('Google Places took too long to respond. Check the API key and try again.'));
    }, 15000);

    window[callbackName] = () => {
      window.clearTimeout(timeout);
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener('error', () => reject(new Error('Google Maps could not be loaded.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}&v=weekly&loading=async&callback=${callbackName}`;
    script.onerror = () => {
      window.clearTimeout(timeout);
      loaderPromise = undefined;
      reject(new Error('Google Maps could not be loaded. Check the key restrictions and your connection.'));
    };
    document.head.append(script);
  });

  return loaderPromise;
}

export async function searchDestinationSuggestions(input, sessionToken = null) {
  return withTimeout((async () => {
    await loadGoogleMaps();
    const { AutocompleteSessionToken, AutocompleteSuggestion } = await window.google.maps.importLibrary('places');
    const token = sessionToken ?? new AutocompleteSessionToken();
    const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: input.trim(),
      includedPrimaryTypes: ['(cities)'],
      sessionToken: token,
    });
    return {
      sessionToken: token,
      suggestions: (suggestions ?? [])
        .map((suggestion) => serializeDestinationPrediction(suggestion.placePrediction))
        .filter((suggestion) => suggestion?.name)
        .slice(0, 6),
    };
  })(), 7000, 'City suggestions took too long to respond.');
}

export async function resolveDestinationSuggestion(suggestion) {
  if (!suggestion?.prediction) {
    return { name: suggestion?.name || '', address: suggestion?.fullText || suggestion?.name || '' };
  }
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress'] });
  return {
    id: place.id || suggestion.placeId,
    name: place.displayName || suggestion.name,
    address: place.formattedAddress || suggestion.fullText,
  };
}

function titleCase(value = '') {
  return String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function photoDetails(photos = [], usedImages = null, {
  maxWidth = 1200,
  maxHeight = 900,
  preferLandscape = false,
} = {}) {
  const rankedPhotos = [...photos].slice(0, 20).sort((left, right) => {
    const leftLandscape = preferLandscape && Number(left.widthPx) >= Number(left.heightPx) ? 1 : 0;
    const rightLandscape = preferLandscape && Number(right.widthPx) >= Number(right.heightPx) ? 1 : 0;
    const leftArea = Number(left.widthPx ?? 0) * Number(left.heightPx ?? 0);
    const rightArea = Number(right.widthPx ?? 0) * Number(right.heightPx ?? 0);
    return (rightLandscape - leftLandscape) || (rightArea - leftArea);
  });

  for (const photo of rankedPhotos) {
    const image = photo.getURI?.({ maxWidth, maxHeight })
      ?? photo.getUrl?.({ maxWidth, maxHeight })
      ?? '';
    if (!image || usedImages?.has(image)) continue;
    usedImages?.add(image);
    const photoAttributions = (photo.authorAttributions ?? []).map((author) => ({
      name: author.displayName,
      uri: author.uri,
    })).filter((author) => author.name);
    return { image, photoAttributions };
  }
  return { image: '', photoAttributions: [] };
}

function openingSummary(place) {
  const descriptions = place.regularOpeningHours?.weekdayDescriptions;
  if (!descriptions?.length) return '';
  const offset = Number(place.utcOffsetMinutes ?? 0);
  const destinationTime = new Date(Date.now() + (offset * 60000));
  const dayIndex = destinationTime.getUTCDay();
  return descriptions[dayIndex] ?? descriptions[0] ?? '';
}

function formatMoney(money) {
  if (!money?.currencyCode) return '';
  const amount = Number(money.units ?? 0) + (Number(money.nanos ?? 0) / 1_000_000_000);
  if (!Number.isFinite(amount)) return '';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: money.currencyCode,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${money.currencyCode}`;
  }
}

function formatPriceRange(priceRange) {
  const start = formatMoney(priceRange?.startPrice);
  const end = formatMoney(priceRange?.endPrice);
  if (start && end) return `${start}–${end}`;
  if (start) return `From ${start}`;
  return '';
}

function distanceInMiles(from, to) {
  if (!from || !to) return null;
  const radians = (degrees) => degrees * (Math.PI / 180);
  const latDistance = radians(to.lat - from.lat);
  const lngDistance = radians(to.lng - from.lng);
  const a = Math.sin(latDistance / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(lngDistance / 2) ** 2;
  return 3958.8 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function applyDistanceFromStay(places, stay) {
  if (!stay?.coordinates) return places;
  return places.map((place) => {
    const distance = distanceInMiles(stay.coordinates, place.coordinates);
    return {
      ...place,
      distance: distance === null ? '' : `${distance.toFixed(distance < 10 ? 1 : 0)} mi from your stay`,
      distanceMiles: distance,
      directionsHref: distance === null ? '' : `https://www.google.com/maps/dir/?api=1&origin=${stay.coordinates.lat},${stay.coordinates.lng}&destination_place_id=${encodeURIComponent(place.id)}&travelmode=walking`,
    };
  }).sort((a, b) => (a.distanceMiles ?? Infinity) - (b.distanceMiles ?? Infinity));
}

function walkingRouteCacheKey(places, stay) {
  const origin = stay?.placeId || stay?.id
    || `${Number(stay?.coordinates?.lat).toFixed(5)},${Number(stay?.coordinates?.lng).toFixed(5)}`;
  const destinations = places.map((place) => place.placeId || place.id || (
    `${Number(place.coordinates?.lat).toFixed(5)},${Number(place.coordinates?.lng).toFixed(5)}`
  ));
  return `${origin}::${destinations.join('|')}`;
}

export function mergeWalkingRoutes(places, items = [], stay) {
  const fallbackPlaces = applyDistanceFromStay(places, stay);
  const fallbackById = new Map(fallbackPlaces.map((place) => [place.id, place]));

  return places.map((place, index) => {
    const fallback = fallbackById.get(place.id) ?? place;
    const route = items[index];
    const routeExists = route && (!route.condition || route.condition === 'ROUTE_EXISTS');
    const durationMillis = routeExists ? Number(route.durationMillis) : Number.NaN;
    const distanceMeters = routeExists ? Number(route.distanceMeters) : Number.NaN;
    if (!Number.isFinite(durationMillis) || durationMillis <= 0) return fallback;

    const walkingMinutes = Math.max(1, Math.round(durationMillis / 60000));
    const routedMiles = Number.isFinite(distanceMeters) ? distanceMeters / 1609.344 : fallback.distanceMiles;
    return {
      ...fallback,
      distance: `${walkingMinutes} min walk from your stay`,
      walkingMinutes,
      routeDistanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      distanceMiles: routedMiles,
    };
  });
}

export async function fetchWalkingTimesFromStay(places, stay) {
  if (!stay?.coordinates || !places.length) return applyDistanceFromStay(places, stay);

  const routablePlaces = places.filter((place) => place.coordinates).slice(0, 25);
  if (!routablePlaces.length) return applyDistanceFromStay(places, stay);

  const cacheKey = walkingRouteCacheKey(routablePlaces, stay);
  if (walkingRouteCache.has(cacheKey)) return walkingRouteCache.get(cacheKey);

  const request = (async () => {
    await loadGoogleMaps();
    const { RouteMatrix } = await window.google.maps.importLibrary('routes');
    const { matrix } = await withTimeout(RouteMatrix.computeRouteMatrix({
      origins: [stay.coordinates],
      destinations: routablePlaces.map((place) => place.coordinates),
      travelMode: 'WALKING',
      fields: ['durationMillis', 'distanceMeters', 'condition'],
    }), 10000, 'Walking times took too long to respond.');
    const routed = mergeWalkingRoutes(routablePlaces, matrix?.rows?.[0]?.items ?? [], stay);
    const routedById = new Map(routed.map((place) => [place.id, place]));
    return places.map((place) => routedById.get(place.id) ?? place);
  })();

  walkingRouteCache.set(cacheKey, request);
  request.catch(() => walkingRouteCache.delete(cacheKey));
  return request;
}

function serializePlace(place, { center = null, guideCategory = '', usedImages = null } = {}) {
  const coordinates = place.location?.toJSON?.() ?? (place.location ? {
    lat: place.location.lat(),
    lng: place.location.lng(),
  } : undefined);
  const distance = distanceInMiles(center, coordinates);
  const { image, photoAttributions } = photoDetails(place.photos, usedImages);

  return {
    id: place.id,
    placeId: place.id,
    name: place.displayName || 'Unnamed place',
    address: place.formattedAddress || '',
    description: place.formattedAddress || 'Address not available',
    category: place.primaryTypeDisplayName || titleCase(place.primaryType) || 'Place',
    guideCategory,
    rating: place.rating ? Number(place.rating).toFixed(1) : '',
    userRatingCount: place.userRatingCount ?? 0,
    price: priceLabels[place.priceLevel] ?? '',
    priceLevel: place.priceLevel ?? '',
    openingText: openingSummary(place),
    coordinates,
    distance: distance === null ? '' : `${distance.toFixed(distance < 10 ? 1 : 0)} mi from center`,
    image,
    imageAlt: place.displayName || 'Destination place',
    photoAttributions,
    businessStatus: place.businessStatus ?? '',
  };
}

async function findCity(cityName) {
  const key = cityName.trim().toLowerCase();
  if (cityCache.has(key)) return cityCache.get(key);

  const request = (async () => {
    await loadGoogleMaps();
    const { Place } = await window.google.maps.importLibrary('places');
    const fields = ['id', 'displayName', 'formattedAddress', 'location', 'viewport', 'photos'];
    let city;
    for (const includedType of ['locality', 'administrative_area_level_1', 'country']) {
      const result = await Place.searchByText({
        textQuery: cityName,
        fields,
        includedType,
        useStrictTypeFiltering: true,
        maxResultCount: 1,
      });
      city = result.places?.[0];
      if (city) break;
    }
    if (!city) {
      const fallbackResult = await Place.searchByText({
        textQuery: `${cityName} destination`,
        fields,
        maxResultCount: 1,
      });
      city = fallbackResult.places?.[0];
    }
    if (!city?.location) throw new Error(`We could not find “${cityName}”. Try a city and country together.`);
    return city;
  })();

  cityCache.set(key, request);
  request.catch(() => cityCache.delete(key));
  return request;
}

export async function fetchDestinationPreview(cityName, photoQuery = '') {
  const city = await findCity(cityName);
  const { Place } = await window.google.maps.importLibrary('places');
  const landmarkResult = await Place.searchByText({
    textQuery: photoQuery || `iconic scenic viewpoint in ${cityName}`,
    fields: ['id', 'displayName', 'photos'],
    locationBias: city.viewport ?? city.location,
    maxResultCount: 5,
  }).catch(() => ({ places: [] }));
  const landmarkPhotos = (landmarkResult.places ?? []).flatMap((place) => place.photos ?? []);
  const { image, photoAttributions } = photoDetails(
    [...landmarkPhotos, ...(city.photos ?? [])],
    null,
    { maxWidth: 1800, maxHeight: 1400, preferLandscape: true },
  );
  if (!image) throw new Error(`A destination photo for ${cityName} is not available right now.`);
  return {
    image,
    imageAlt: `${city.displayName || cityName} travel view`,
    photoAttributions,
  };
}

export async function searchDestinationPlaces({ cityName, category, fallbackImage = '', stay = null }) {
  const stayKey = stay?.id || (stay?.coordinates ? `${stay.coordinates.lat},${stay.coordinates.lng}` : '');
  const cacheKey = `${cityName.trim().toLowerCase()}::${category}::${stayKey}`;
  if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

  const request = (async () => {
    const city = await findCity(cityName);
    const { Place } = await window.google.maps.importLibrary('places');
    const searches = category === 'Top things to do'
      ? [
        { query: 'most popular highly rated attractions', count: 8, guideCategory: 'Top things to do' },
        { query: 'most popular highly rated restaurants and food spots', count: 6, guideCategory: 'Food & drink' },
        { query: 'most popular shopping landmarks and clothing stores', count: 5, guideCategory: 'Shopping' },
      ]
      : [{ query: categoryQueries[category] ?? categoryQueries['Top things to do'], count: 12, guideCategory: category }];
    const resultGroups = await Promise.all(searches.map(async (search) => {
      const { places = [] } = await Place.searchByText({
        textQuery: `${search.query} in ${cityName}`,
        fields: placeFields,
        locationBias: stay?.coordinates ?? city.viewport ?? city.location,
        maxResultCount: search.count,
      });
      return places.map((place) => ({ place, guideCategory: search.guideCategory }));
    }));
    const center = city.location.toJSON?.() ?? {
      lat: city.location.lat(),
      lng: city.location.lng(),
    };

    const usedImages = new Set();
    const uniquePlaces = [];
    const seenIds = new Set();
    resultGroups.flat().forEach((record) => {
      if (!record.place?.id || seenIds.has(record.place.id)) return;
      seenIds.add(record.place.id);
      uniquePlaces.push(record);
    });

    return {
      city: {
        id: city.id,
        name: city.displayName || cityName,
        address: city.formattedAddress || cityName,
      },
      center,
      viewport: city.viewport ?? null,
      places: uniquePlaces.slice(0, 16).map(({ place, guideCategory }) => serializePlace(place, { center, guideCategory, usedImages })),
    };
  })();

  searchCache.set(cacheKey, request);
  request.catch(() => searchCache.delete(cacheKey));
  return request;
}

export async function searchPlacesForPrompt({ cityName, prompt, fallbackImage = '', stay = null }) {
  const cacheKey = `${cityName.trim().toLowerCase()}::${prompt.trim().toLowerCase()}::${stay?.id ?? ''}`;
  if (promptSearchCache.has(cacheKey)) return promptSearchCache.get(cacheKey);

  const request = (async () => {
    const city = await findCity(cityName);
    const { Place } = await window.google.maps.importLibrary('places');
    const { places } = await Place.searchByText({
      textQuery: `${prompt} in ${cityName}`,
      fields: placeFields,
      locationBias: stay?.coordinates ?? city.viewport ?? city.location,
      maxResultCount: 16,
    });
    const center = stay?.coordinates ?? city.location.toJSON?.() ?? {
      lat: city.location.lat(),
      lng: city.location.lng(),
    };
    const usedImages = new Set();
    const serialized = (places ?? []).map((place) => serializePlace(place, { center, guideCategory: 'For you', usedImages }));
    return stay ? applyDistanceFromStay(serialized, stay) : serialized;
  })();

  promptSearchCache.set(cacheKey, request);
  request.catch(() => promptSearchCache.delete(cacheKey));
  return request;
}

export async function searchStayPlaces({ cityName, query }) {
  const cacheKey = `${cityName.trim().toLowerCase()}::${query.trim().toLowerCase()}`;
  if (staySearchCache.has(cacheKey)) return staySearchCache.get(cacheKey);

  const request = (async () => {
    const city = await findCity(cityName);
    const { Place } = await window.google.maps.importLibrary('places');
    const { places } = await Place.searchByText({
      textQuery: `${query} in ${cityName}`,
      fields: ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'primaryTypeDisplayName'],
      locationBias: city.viewport ?? city.location,
      maxResultCount: 5,
    });
    return (places ?? []).filter(isStayPlaceCandidate).map((place) => ({
      id: place.id,
      placeId: place.id,
      name: place.displayName || query,
      address: place.formattedAddress || '',
      category: place.primaryTypeDisplayName || 'Stay',
      coordinates: place.location?.toJSON?.() ?? (place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null),
    }));
  })();

  staySearchCache.set(cacheKey, request);
  request.catch(() => staySearchCache.delete(cacheKey));
  return request;
}

export async function searchNearbyDestinations(cityName) {
  const cacheKey = cityName.trim().toLowerCase();
  if (nearbyDestinationCache.has(cacheKey)) return nearbyDestinationCache.get(cacheKey);

  const request = withTimeout((async () => {
    const city = await findCity(cityName);
    const { Place } = await window.google.maps.importLibrary('places');
    const fields = ['id', 'displayName', 'formattedAddress', 'location', 'primaryType'];
    const cityCenter = city.location.toJSON?.() ?? { lat: city.location.lat(), lng: city.location.lng() };
    let places = [];
    try {
      ({ places = [] } = await Place.searchByText({
        textQuery: `popular towns and cities near ${cityName}`,
        fields,
        includedType: 'locality',
        locationBias: city.location,
        maxResultCount: 10,
      }));
    } catch {
      ({ places = [] } = await Place.searchByText({
        textQuery: `popular day trip destinations near ${cityName}`,
        fields,
        locationBias: city.location,
        maxResultCount: 10,
      }));
    }

    return places.map((place) => {
      const coordinates = place.location?.toJSON?.() ?? (place.location ? {
        lat: place.location.lat(), lng: place.location.lng(),
      } : null);
      const miles = distanceInMiles(cityCenter, coordinates);
      return {
        id: place.id,
        placeId: place.id,
        name: place.displayName || '',
        address: place.formattedAddress || '',
        coordinates,
        distanceMiles: miles,
        distanceLabel: Number.isFinite(miles) ? `${Math.round(miles)} mi away` : '',
      };
    }).filter((place) => (
      place.name
      && place.name.toLowerCase() !== cityName.trim().toLowerCase()
      && (!Number.isFinite(place.distanceMiles) || (place.distanceMiles >= 8 && place.distanceMiles <= 250))
    )).slice(0, 6);
  })(), 9000, 'Nearby destination ideas took too long to respond.');

  nearbyDestinationCache.set(cacheKey, request);
  request.catch(() => nearbyDestinationCache.delete(cacheKey));
  return request;
}

export async function fetchNeighborhoodPreviews({ cityName, neighborhoods = [] }) {
  const names = neighborhoods.map((name) => String(name).trim()).filter(Boolean).slice(0, 4);
  if (!names.length) return [];

  const cacheKey = `${cityName.trim().toLowerCase()}::${names.map((name) => name.toLowerCase()).join('|')}`;
  if (neighborhoodPreviewCache.has(cacheKey)) return neighborhoodPreviewCache.get(cacheKey);

  const request = (async () => {
    const city = await findCity(cityName);
    const { Place } = await window.google.maps.importLibrary('places');
    const usedImages = new Set();

    return Promise.all(names.map(async (name) => {
      try {
        const { places } = await Place.searchByText({
          textQuery: `${name} neighborhood in ${cityName}`,
          fields: ['id', 'displayName', 'formattedAddress', 'photos'],
          locationBias: city.viewport ?? city.location,
          maxResultCount: 3,
        });

        for (const place of places ?? []) {
          const { image, photoAttributions } = photoDetails(place.photos, usedImages);
          if (image) {
            return {
              name,
              placeId: place.id,
              image,
              imageAlt: `${name}, ${cityName}`,
              photoAttributions,
            };
          }
        }
      } catch {
        // The recommendation remains useful even when an area has no Google photo.
      }
      return { name, image: '', imageAlt: `${name}, ${cityName}`, photoAttributions: [] };
    }));
  })();

  neighborhoodPreviewCache.set(cacheKey, request);
  request.catch(() => neighborhoodPreviewCache.delete(cacheKey));
  return request;
}

export async function fetchStayPlace(placeId) {
  await loadGoogleMaps();
  const { Place } = await window.google.maps.importLibrary('places');
  const place = new Place({ id: placeId });
  await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'primaryTypeDisplayName'] });
  return {
    id: place.id,
    placeId: place.id,
    name: place.displayName || 'Your stay',
    address: place.formattedAddress || '',
    category: place.primaryTypeDisplayName || 'Stay',
    coordinates: place.location?.toJSON?.() ?? (place.location ? { lat: place.location.lat(), lng: place.location.lng() } : null),
  };
}

export async function fetchGooglePlace(placeId, { fallbackImage = '' } = {}) {
  if (placeCache.has(placeId)) return placeCache.get(placeId);

  const request = (async () => {
    await loadGoogleMaps();
    const { Place } = await window.google.maps.importLibrary('places');
    const place = new Place({ id: placeId });
    await place.fetchFields({ fields: placeFields });
    return serializePlace(place);
  })();

  placeCache.set(placeId, request);
  request.catch(() => placeCache.delete(placeId));
  return request;
}

export async function fetchGooglePlaceDetails(placeId) {
  if (placeDetailsCache.has(placeId)) return placeDetailsCache.get(placeId);

  const request = (async () => {
    await loadGoogleMaps();
    const { Place } = await window.google.maps.importLibrary('places');
    const place = new Place({ id: placeId });
    await place.fetchFields({
      fields: [
        'id',
        'displayName',
        'formattedAddress',
        'primaryTypeDisplayName',
        'rating',
        'userRatingCount',
        'priceLevel',
        'priceRange',
        'currentOpeningHours',
        'regularOpeningHours',
        'editorialSummary',
        'businessStatus',
        'websiteURI',
        'googleMapsURI',
        'nationalPhoneNumber',
      ],
    });

    const hours = place.currentOpeningHours ?? place.regularOpeningHours;
    return {
      id: place.id,
      name: place.displayName || '',
      address: place.formattedAddress || '',
      category: place.primaryTypeDisplayName || '',
      rating: place.rating ? Number(place.rating).toFixed(1) : '',
      userRatingCount: place.userRatingCount ?? 0,
      price: priceLabels[place.priceLevel] ?? '',
      priceRange: formatPriceRange(place.priceRange),
      openingHours: hours?.weekdayDescriptions ?? [],
      openNow: typeof hours?.openNow === 'boolean' ? hours.openNow : null,
      summary: place.editorialSummary || '',
      businessStatus: place.businessStatus ?? '',
      websiteURI: place.websiteURI || '',
      googleMapsURI: place.googleMapsURI || '',
      phone: place.nationalPhoneNumber || '',
    };
  })();

  placeDetailsCache.set(placeId, request);
  request.catch(() => placeDetailsCache.delete(placeId));
  return request;
}
