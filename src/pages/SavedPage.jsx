import {
  ArrowRight, BedDouble, Bookmark, ChevronDown, MapPin, RefreshCw, Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { PlacesMap } from '../components/PlacesMap';
import { SaveButton } from '../components/SaveButton';
import { SiteLayout } from '../components/SiteLayout';
import { TripItinerary } from '../components/TripItinerary';
import { TripRecommendations } from '../components/TripRecommendations';
import { useAuth } from '../context/AuthContext';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useTrip } from '../context/TripContext';
import { useSavedPlaceDetails } from '../hooks/useSavedPlaceDetails';

function TripPlaceIndex({ places, mapPlaces, selectedId, pendingIds, onSelect, onRemove }) {
  const markerNumbers = new Map(mapPlaces.map((place, index) => [place.id, index + 1]));

  if (!places.length) {
    return (
      <div className="trip-place-index trip-place-index--empty">
        <div className="trip-place-index__heading"><h3>Saved activities</h3><span>0</span></div>
        <p>Save a landmark, restaurant, or shop and it will appear here beside the map.</p>
      </div>
    );
  }

  return (
    <div className="trip-place-index">
      <div className="trip-place-index__heading"><h3>Saved activities</h3><span>{places.length}</span></div>
      <ol>
        {places.map((place) => {
          const markerNumber = markerNumbers.get(place.id);
          const selected = selectedId === place.id;
          const meta = [place.category, place.rating ? `★ ${place.rating}` : null].filter(Boolean);
          return (
            <li key={place.id} className={selected ? 'is-selected' : ''}>
              <button
                type="button"
                className="trip-place-index__toggle"
                onClick={() => onSelect(selected ? null : place.id)}
                aria-expanded={selected}
              >
                <span className="trip-place-index__number" aria-label={markerNumber ? `Map marker ${markerNumber}` : 'Not plotted'}>{markerNumber ?? '–'}</span>
                {place.image ? <img src={place.image} alt="" referrerPolicy="origin" /> : <span className="trip-place-index__image-fallback" />}
                <span className="trip-place-index__name"><strong>{place.name}</strong><small>{meta.join(' · ') || place.destination}</small></span>
                <ChevronDown size={15} aria-hidden="true" />
              </button>
              {selected ? (
                <div className="trip-place-index__details">
                  <p>{place.address || place.destination || 'Address unavailable'}</p>
                  <div>
                    {markerNumber ? <button type="button" onClick={() => onSelect(place.id)}><MapPin size={13} />Marker {markerNumber}</button> : <span>Map coordinates unavailable</span>}
                    <SaveButton label={place.name} isSaved disabled={pendingIds.includes(place.id)} onClick={() => onRemove(place)} />
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function placeCountLabel(count) {
  return `${count} ${count === 1 ? 'place' : 'places'}`;
}

function tripCenter(places, stay) {
  const coordinates = [stay, ...places].map((place) => place?.coordinates).filter(Boolean);
  if (!coordinates.length) return null;
  return {
    lat: coordinates.reduce((sum, point) => sum + point.lat, 0) / coordinates.length,
    lng: coordinates.reduce((sum, point) => sum + point.lng, 0) / coordinates.length,
  };
}

export function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    trip, trips, activeTripId, selectTrip, removeTrip,
  } = useTrip();
  const {
    savedPlaces, savedCount, loading, error, pendingIds, toggleSavedPlace, retry,
  } = useSavedPlaces();
  const { places: detailedPlaces, loading: detailsLoading } = useSavedPlaceDetails(savedPlaces);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [removingTrip, setRemovingTrip] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [removeNotice, setRemoveNotice] = useState('');
  const mapPlaces = useMemo(() => detailedPlaces.filter((place) => place.coordinates), [detailedPlaces]);
  const center = useMemo(() => tripCenter(mapPlaces, trip?.stay), [mapPlaces, trip?.stay]);
  const destinationNames = (trip?.destinations ?? []).map((destination) => destination.name).filter(Boolean);
  const tripLabel = destinationNames.length ? destinationNames.join(' · ') : 'Destination open';
  const dates = trip?.dates?.start && trip?.dates?.end ? `${trip.dates.start} – ${trip.dates.end}` : 'Dates open';

  const confirmRemoveTrip = async () => {
    if (!trip?.id || removingTrip) return;
    const removedTitle = trip.title || 'Trip';
    setRemovingTrip(true);
    setRemoveError('');
    try {
      await removeTrip(trip.id);
      setConfirmingRemoval(false);
      setRemoveNotice(`${removedTitle} was removed.`);
    } catch (removalError) {
      setRemoveError(removalError?.message || 'This trip could not be removed. Try again.');
    } finally {
      setRemovingTrip(false);
    }
  };

  return (
    <SiteLayout active="trip" savedCount={savedCount}>
      <header className="saved-header trip-header">
        <div>
          <span className="trip-header__eyebrow">My Trips</span>
          <h1>{trip?.title || 'My Trip'}</h1>
          <p>Each vacation keeps its own stay, saved places, map, and itinerary.</p>
          <div className="trip-header__meta"><span>{tripLabel}</span><span>{dates}</span></div>
        </div>
        <div className="trip-header__actions">
          <a className="text-link" href="#search">Add another place <ArrowRight size={16} /></a>
          {user && trip ? <button type="button" onClick={() => { setConfirmingRemoval(true); setRemoveNotice(''); }}><Trash2 size={14} />Remove this trip</button> : null}
        </div>
      </header>

      {user && !loading && !error && trips.length > 1 ? (
        <nav className="trip-switcher" aria-label="Choose a trip">
          <span>Your trips</span>
          <div>
            {trips.map((item) => (
              <button type="button" key={item.id} className={item.id === activeTripId ? 'is-active' : ''} aria-pressed={item.id === activeTripId} onClick={() => { setConfirmingRemoval(false); selectTrip(item.id); }}>
                {item.title || 'My Trip'}
              </button>
            ))}
          </div>
        </nav>
      ) : null}

      {confirmingRemoval && trip ? (
        <div className="trip-remove-confirmation" role="alert">
          <div><strong>Remove {trip.title || 'this trip'}?</strong><span>This deletes its stay, saved activities, and itinerary. Your account and other trips will stay untouched.</span></div>
          <div>
            <button type="button" onClick={() => { setConfirmingRemoval(false); setRemoveError(''); }} disabled={removingTrip}>Keep trip</button>
            <button type="button" onClick={confirmRemoveTrip} disabled={removingTrip}>{removingTrip ? 'Removing…' : 'Remove permanently'}</button>
          </div>
          {removeError ? <p>{removeError}</p> : null}
        </div>
      ) : null}

      {removeNotice ? <p className="trip-remove-notice" role="status">{removeNotice}</p> : null}

      {authLoading || (user && (loading || detailsLoading)) ? (
        <div className="saved-state" role="status"><span className="saved-state__pulse" />Loading My Trip…</div>
      ) : null}

      {!authLoading && !user ? (
        <div className="saved-empty">
          <Bookmark />
          <h2>Sign in to start My Trip</h2>
          <p>Your trip will stay with your account between visits and devices.</p>
          <a className="primary-button" href="#auth">Sign in or create an account</a>
        </div>
      ) : null}

      {user && error ? (
        <div className="saved-empty saved-empty--error">
          <RefreshCw />
          <h2>My Trip is not available yet</h2>
          <p>{error}</p>
          <button className="primary-button" type="button" onClick={retry}>Try again</button>
        </div>
      ) : null}

      {user && !loading && !detailsLoading && !error ? (
        <section className="trip-overview" aria-labelledby="trip-map-title">
          <div className="trip-overview__details">
            <div className="saved-group__heading"><h2 id="trip-map-title">Trip at a glance</h2><span>{placeCountLabel(savedCount)}</span></div>
            {trip?.stay ? (
              <div className="trip-stay">
                <BedDouble size={20} aria-hidden="true" />
                <div><span>Home base</span><strong>{trip.stay.name || 'Saved stay'}</strong><small>{trip.stay.address || trip.stay.destination}</small></div>
                <a href={`#destination?place=${encodeURIComponent(trip.stay.destinationId || '')}&city=${encodeURIComponent(trip.stay.destination || '')}&trip=${encodeURIComponent(trip.id || activeTripId)}`}>Change</a>
              </div>
            ) : (
              <div className="trip-stay trip-stay--empty">
                <BedDouble size={20} aria-hidden="true" />
                <div><span>Home base</span><strong>No stay added yet</strong><small>Add a hotel, address, or neighborhood from a destination page.</small></div>
              </div>
            )}
            <TripPlaceIndex
              places={detailedPlaces}
              mapPlaces={mapPlaces}
              selectedId={selectedPlace}
              pendingIds={pendingIds}
              onSelect={setSelectedPlace}
              onRemove={toggleSavedPlace}
            />
            <p className="trip-overview__note">The list numbers match the map pins. Open a row to see its address or remove it from this trip.</p>
          </div>
          {center ? (
            <PlacesMap
              places={mapPlaces}
              selectedId={selectedPlace}
              onSelect={setSelectedPlace}
              destinationName="My Trip"
              center={center}
              loading={false}
              error=""
              stay={trip?.stay ?? null}
            />
          ) : (
            <div className="trip-map-empty"><MapPin size={22} /><span>Your saved places will appear together here.</span></div>
          )}
        </section>
      ) : null}

      {user && !loading && !detailsLoading && !error ? <TripItinerary trip={trip} places={detailedPlaces} /> : null}

      {user && !loading && !detailsLoading && !error && savedCount === 0 ? (
        <div className="saved-empty trip-empty">
          <Bookmark />
          <h2>Your trip is ready to take shape</h2>
          <p>Search for a destination, then save activities to bring them into My Trip.</p>
          <a className="primary-button" href="#search">Search a destination</a>
        </div>
      ) : null}

      {user && !loading && !detailsLoading && !error ? <TripRecommendations trip={trip} /> : null}
    </SiteLayout>
  );
}
