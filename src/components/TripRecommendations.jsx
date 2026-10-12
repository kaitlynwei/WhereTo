import { ArrowRight, Compass, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { searchDestinationPlaces } from '../lib/googleMaps';
import { destinationSlug } from '../lib/navigation';
import { rankDestinationPlaces, reviewCountLabel } from '../lib/placeRanking';
import { savedGooglePlace } from '../lib/savedPlaces';
import { SaveButton } from './SaveButton';

function destinationHref(destination, tripId) {
  const params = new URLSearchParams({
    place: destination.id || destinationSlug(destination.name),
    city: destination.name,
    trip: tripId,
  });
  return `#destination?${params.toString()}`;
}

function RecommendationCard({ place, destination, tripId, pending, onSave }) {
  const attribution = place.photoAttributions?.[0];
  const meta = [place.category, place.rating ? `★ ${place.rating}` : null, reviewCountLabel(place.userRatingCount), place.price].filter(Boolean);

  return (
    <article className="trip-discovery-card">
      <a href={destinationHref(destination, tripId)} aria-label={`Explore ${place.name} in ${destination.name}`}>
        <figure>
          {place.image ? <img src={place.image} alt={place.imageAlt || place.name} referrerPolicy="origin" /> : <span className="trip-discovery-card__fallback"><Compass size={20} /></span>}
          {attribution ? <figcaption>Photo: {attribution.name}</figcaption> : null}
        </figure>
        <div>
          <span>{place.guideCategory || place.category}</span>
          <h3>{place.name}</h3>
          <p>{meta.join(' · ')}</p>
        </div>
      </a>
      <SaveButton label={place.name} isSaved={false} disabled={pending} onClick={() => onSave(place)} />
    </article>
  );
}

export function TripRecommendations({ trip }) {
  const {
    activeTripId, savedIds, pendingIds, toggleSavedPlace,
  } = useTrip();
  const destination = trip?.destinations?.[0] ?? null;
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!destination?.name) {
      setPlaces([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError('');
    searchDestinationPlaces({ cityName: destination.name, category: 'Top things to do', stay: trip?.stay ?? null }).then((result) => {
      if (!active) return;
      setPlaces(result.places ?? []);
      setLoading(false);
    }).catch((searchError) => {
      if (!active) return;
      setPlaces([]);
      setLoading(false);
      setError(searchError?.message || 'More places are unavailable right now.');
    });
    return () => { active = false; };
  }, [destination?.name, retryKey, trip?.stay?.coordinates?.lat, trip?.stay?.coordinates?.lng, trip?.stay?.id]);

  const suggestions = useMemo(() => {
    const saved = new Set(savedIds);
    const categories = new Set();
    const diverse = [];
    const remaining = [];
    const ranked = rankDestinationPlaces(places, {
      tripPreferences: trip?.preferences,
      hasStay: Boolean(trip?.stay?.coordinates),
    });
    ranked.forEach((place) => {
      if (saved.has(place.id)) return;
      const group = place.guideCategory || place.category;
      if (!categories.has(group)) {
        categories.add(group);
        diverse.push(place);
      } else {
        remaining.push(place);
      }
    });
    return [...diverse, ...remaining].slice(0, 6);
  }, [places, savedIds, trip?.preferences, trip?.stay?.coordinates]);

  const save = (place) => toggleSavedPlace(savedGooglePlace(place, {
    displayName: destination.name,
    name: destination.name,
  }));

  if (!destination?.name) return null;

  return (
    <section className="trip-discovery" aria-labelledby="trip-discovery-title">
      <header>
        <div>
          <span>Keep discovering</span>
          <h2 id="trip-discovery-title">More to explore in {destination.name}</h2>
          <p>Highly rated, widely reviewed landmarks, restaurants, and shopping—ranked around your trip{trip?.stay ? ' and saved stay' : ''}.</p>
        </div>
        <a href={destinationHref(destination, activeTripId)}>View the full city guide <ArrowRight size={15} /></a>
      </header>

      {loading ? (
        <div className="trip-discovery__loading" role="status"><span className="saved-state__pulse" />Finding more places…</div>
      ) : null}

      {!loading && error ? (
        <div className="trip-discovery__error">
          <p>{error}</p>
          <button type="button" onClick={() => setRetryKey((current) => current + 1)}><RefreshCw size={14} />Try again</button>
        </div>
      ) : null}

      {!loading && !error && suggestions.length ? (
        <div className="trip-discovery__grid">
          {suggestions.map((place) => (
            <RecommendationCard
              key={place.id}
              place={place}
              destination={destination}
              tripId={activeTripId}
              pending={pendingIds.includes(place.id)}
              onSave={save}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
