import { ArrowRight, MapPin, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTrip } from '../context/TripContext';
import {
  searchDestinationSuggestions,
  searchNearbyDestinations,
} from '../lib/googleMaps';
import { destinationSlug } from '../lib/navigation';

const nearbyFallbacks = {
  'new york': [
    { name: 'Boston', address: 'Massachusetts, United States', distanceLabel: 'Popular East Coast add-on' },
    { name: 'Washington, D.C.', address: 'District of Columbia, United States', distanceLabel: 'Easy rail extension' },
    { name: 'Philadelphia', address: 'Pennsylvania, United States', distanceLabel: 'Easy train add-on' },
    { name: 'Montreal', address: 'Quebec, Canada', distanceLabel: 'Popular two-city trip' },
    { name: 'Toronto', address: 'Ontario, Canada', distanceLabel: 'Popular city pairing' },
    { name: 'Miami', address: 'Florida, United States', distanceLabel: 'Warm-weather extension' },
  ],
  'new york city': [
    { name: 'Boston', address: 'Massachusetts, United States', distanceLabel: 'Popular East Coast add-on' },
    { name: 'Washington, D.C.', address: 'District of Columbia, United States', distanceLabel: 'Easy rail extension' },
    { name: 'Philadelphia', address: 'Pennsylvania, United States', distanceLabel: 'Easy train add-on' },
    { name: 'Montreal', address: 'Quebec, Canada', distanceLabel: 'Popular two-city trip' },
    { name: 'Toronto', address: 'Ontario, Canada', distanceLabel: 'Popular city pairing' },
    { name: 'Miami', address: 'Florida, United States', distanceLabel: 'Warm-weather extension' },
  ],
  paris: [
    { name: 'London', address: 'United Kingdom', distanceLabel: 'Popular rail extension' },
    { name: 'Amsterdam', address: 'Netherlands', distanceLabel: 'Popular European add-on' },
    { name: 'Rome', address: 'Italy', distanceLabel: 'Classic two-city trip' },
    { name: 'Brussels', address: 'Belgium', distanceLabel: 'Easy rail add-on' },
    { name: 'Barcelona', address: 'Spain', distanceLabel: 'Popular city-and-sun pairing' },
    { name: 'Geneva', address: 'Switzerland', distanceLabel: 'Easy European extension' },
  ],
  tokyo: [
    { name: 'Kyoto', address: 'Kyoto, Japan', distanceLabel: 'Classic Japan pairing' },
    { name: 'Osaka', address: 'Osaka, Japan', distanceLabel: 'Popular food-city add-on' },
    { name: 'Seoul', address: 'South Korea', distanceLabel: 'Popular regional extension' },
    { name: 'Yokohama', address: 'Kanagawa, Japan', distanceLabel: 'Easy rail add-on' },
    { name: 'Hiroshima', address: 'Japan', distanceLabel: 'Classic Japan extension' },
    { name: 'Hong Kong', address: 'China', distanceLabel: 'Popular regional pairing' },
  ],
  barcelona: [
    { name: 'Madrid', address: 'Spain', distanceLabel: 'Classic Spain pairing' },
    { name: 'Lisbon', address: 'Portugal', distanceLabel: 'Popular Iberian add-on' },
    { name: 'Nice', address: 'France', distanceLabel: 'Mediterranean extension' },
    { name: 'Valencia', address: 'Spain', distanceLabel: 'Easy coastal add-on' },
    { name: 'Paris', address: 'France', distanceLabel: 'Classic European pairing' },
    { name: 'Rome', address: 'Italy', distanceLabel: 'Popular city extension' },
  ],
  rome: [
    { name: 'Florence', address: 'Tuscany, Italy', distanceLabel: 'Fast-train extension' },
    { name: 'Venice', address: 'Veneto, Italy', distanceLabel: 'Classic Italy pairing' },
    { name: 'Naples', address: 'Campania, Italy', distanceLabel: 'Fast-train extension' },
    { name: 'Milan', address: 'Lombardy, Italy', distanceLabel: 'Popular northern add-on' },
    { name: 'Paris', address: 'France', distanceLabel: 'Classic European pairing' },
    { name: 'Barcelona', address: 'Spain', distanceLabel: 'Popular city-and-sun add-on' },
  ],
  london: [
    { name: 'Paris', address: 'France', distanceLabel: 'Popular rail extension' },
    { name: 'Edinburgh', address: 'Scotland, United Kingdom', distanceLabel: 'Classic UK pairing' },
    { name: 'Amsterdam', address: 'Netherlands', distanceLabel: 'Popular European add-on' },
    { name: 'Dublin', address: 'Ireland', distanceLabel: 'Popular nearby flight' },
    { name: 'Rome', address: 'Italy', distanceLabel: 'Classic European pairing' },
    { name: 'Barcelona', address: 'Spain', distanceLabel: 'Popular city-and-sun add-on' },
  ],
  florence: [
    { name: 'Rome', address: 'Italy', distanceLabel: 'Fast-train extension' },
    { name: 'Venice', address: 'Italy', distanceLabel: 'Classic Italy pairing' },
    { name: 'Milan', address: 'Italy', distanceLabel: 'Popular northern add-on' },
    { name: 'Bologna', address: 'Italy', distanceLabel: 'Easy food-city add-on' },
    { name: 'Paris', address: 'France', distanceLabel: 'Classic European pairing' },
    { name: 'Nice', address: 'France', distanceLabel: 'Mediterranean extension' },
  ],
};

function fallbackNearby(anchor) {
  return nearbyFallbacks[anchor.trim().toLowerCase()] ?? [];
}

function destinationRecord(place) {
  const name = place.name?.trim() || '';
  const location = place.address || place.secondaryText || '';
  return {
    id: destinationSlug(name),
    name,
    country: location.split(',').at(-1)?.trim() || '',
  };
}

function destinationLink(destination, tripId) {
  const params = new URLSearchParams({
    place: destination.id,
    city: destination.name,
    trip: tripId,
  });
  return `#destination?${params.toString()}`;
}

export function TripExtension({ trip }) {
  const { activeTripId, addDestination } = useTrip();
  const [nearby, setNearby] = useState([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState('');
  const sessionToken = useRef(null);
  const searchRequest = useRef(0);
  const anchor = trip?.destinations?.[0]?.name || '';
  const destinationIds = useMemo(() => new Set((trip?.destinations ?? []).map((destination) => destination.id)), [trip?.destinations]);

  useEffect(() => {
    if (!anchor) {
      setNearby([]);
      return undefined;
    }
    let active = true;
    setNearbyLoading(true);
    setNearbyError('');
    searchNearbyDestinations(anchor).then((places) => {
      if (!active) return;
      const familiar = fallbackNearby(anchor);
      const seen = new Set(destinationIds);
      const available = [...familiar, ...places].filter((place) => {
        const id = destinationSlug(place.name);
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 6);
      setNearby(available);
      setNearbyLoading(false);
    }).catch(() => {
      if (!active) return;
      setNearby(fallbackNearby(anchor).filter((place) => !destinationIds.has(destinationSlug(place.name))));
      setNearbyLoading(false);
      if (!fallbackNearby(anchor).length) setNearbyError('Nearby ideas are unavailable right now. You can still search for a city below.');
    });
    return () => { active = false; };
  }, [anchor, destinationIds]);

  useEffect(() => {
    const cleanQuery = query.trim();
    if (cleanQuery.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return undefined;
    }
    const requestId = searchRequest.current + 1;
    searchRequest.current = requestId;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchDestinationSuggestions(cleanQuery, sessionToken.current).then((result) => {
        if (requestId !== searchRequest.current) return;
        sessionToken.current = result.sessionToken;
        setSuggestions(result.suggestions.filter((suggestion) => !destinationIds.has(destinationSlug(suggestion.name))));
        setSearching(false);
      }).catch(() => {
        if (requestId !== searchRequest.current) return;
        setSuggestions([]);
        setSearching(false);
      });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [destinationIds, query]);

  const add = async (place) => {
    const destination = destinationRecord(place);
    if (!destination.id || !destination.name || addingId) return;
    setAddingId(destination.id);
    try {
      await addDestination(destination);
      setNearby((current) => current.filter((item) => destinationSlug(item.name) !== destination.id));
      setSuggestions([]);
      setQuery('');
    } finally {
      setAddingId('');
    }
  };

  return (
    <section className="trip-extension" aria-labelledby="trip-extension-title">
      <div className="trip-extension__intro">
        <div>
          <h2 id="trip-extension-title">Make it a joint trip</h2>
          <p>Add a nearby city when it belongs to the same vacation. Otherwise, saving a stay in a new destination starts a separate trip automatically.</p>
        </div>
        <MapPin size={22} aria-hidden="true" />
      </div>

      {(trip?.destinations?.length ?? 0) > 0 ? (
        <div className="trip-extension__current" aria-label="Destinations in this trip">
          {trip.destinations.map((destination) => (
            <a key={destination.id} href={destinationLink(destination, activeTripId)}>
              <span>{destination.name}</span><ArrowRight size={14} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}

      {anchor ? (
        <div className="trip-extension__nearby">
          <span>Popular additions from {anchor}</span>
          {nearbyLoading ? <p className="trip-extension__status"><span className="saved-state__pulse" />Finding nearby places…</p> : null}
          {!nearbyLoading && nearby.length ? (
            <div>
              {nearby.map((place) => {
                const id = destinationSlug(place.name);
                return (
                  <button type="button" key={place.id || id} onClick={() => add(place)} disabled={Boolean(addingId)}>
                    <span><strong>{place.name}</strong><small>{place.distanceLabel || place.address}</small></span>
                    {addingId === id ? <small>Adding…</small> : <Plus size={15} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ) : null}
          {nearbyError ? <p className="trip-extension__note">{nearbyError}</p> : null}
        </div>
      ) : null}

      <div className="trip-extension__search">
        <label>
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">Add another city to this trip</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Add another city to this trip" autoComplete="off" aria-autocomplete="list" aria-expanded={suggestions.length > 0} />
          {searching ? <small>Searching…</small> : null}
        </label>
        {suggestions.length ? (
          <div className="trip-extension__suggestions" role="listbox" aria-label="Destination suggestions">
            {suggestions.map((suggestion) => (
              <button type="button" key={suggestion.id} onClick={() => add(suggestion)} disabled={Boolean(addingId)}>
                <span><strong>{suggestion.name}</strong><small>{suggestion.secondaryText}</small></span>
                <Plus size={15} aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
