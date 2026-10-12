import { CalendarDays, Clock3, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTrip } from '../context/TripContext';
import { generateTripItinerary } from '../lib/itinerary';
import { TripExtension } from './TripExtension';

const paceOptions = [
  { value: 'relaxed', label: 'Relaxed' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'full', label: 'Full days' },
];

function suggestedDays(trip, placeCount) {
  if (trip?.dates?.start && trip?.dates?.end) {
    const start = new Date(`${trip.dates.start}T12:00:00`);
    const end = new Date(`${trip.dates.end}T12:00:00`);
    const difference = Math.round((end - start) / 86_400_000) + 1;
    if (Number.isFinite(difference) && difference > 0) return Math.min(7, difference);
  }
  return Math.min(3, Math.max(1, Math.ceil(placeCount / 3)));
}

function ItineraryStop({ stop, place }) {
  const content = (
    <>
      <span className="trip-itinerary__time"><Clock3 size={13} />{stop.timeOfDay}</span>
      <strong>{place?.name || 'Saved place'}</strong>
      <small>{[place?.category, place?.rating ? `★ ${place.rating}` : ''].filter(Boolean).join(' · ')}</small>
      <p>{stop.reason}</p>
    </>
  );

  return place?.href ? <a className="trip-itinerary__stop" href={place.href}>{content}</a> : <div className="trip-itinerary__stop">{content}</div>;
}

export function TripItinerary({ trip, places }) {
  const { saveItinerary, clearItinerary } = useTrip();
  const candidates = useMemo(() => places.filter((place) => place.type === 'google-place' && place.id && place.name), [places]);
  const placeById = useMemo(() => new Map(candidates.map((place) => [place.id, place])), [candidates]);
  const [dayCount, setDayCount] = useState(() => suggestedDays(trip, candidates.length));
  const [pace, setPace] = useState(() => String(trip?.preferences?.pace || 'balanced').toLowerCase() === 'packed' ? 'full' : String(trip?.preferences?.pace || 'balanced').toLowerCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const itinerary = trip?.itinerary;
  const canBuild = candidates.length >= 2;

  const build = async () => {
    if (!canBuild || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await generateTripItinerary({
        dayCount,
        pace: ['relaxed', 'balanced', 'full'].includes(pace) ? pace : 'balanced',
        destination: (trip?.destinations ?? []).map((destination) => destination.name).filter(Boolean).join(' and '),
        dates: trip?.dates,
        stay: trip?.stay,
        preferences: trip?.preferences,
        places: candidates.map((place) => ({
          placeId: place.id,
          name: place.name,
          destination: place.destination,
          category: place.category,
          address: place.address,
          rating: place.rating,
          openingText: place.openingText,
          coordinates: place.coordinates,
        })),
      });
      await saveItinerary(result);
    } catch (buildError) {
      setError(buildError.message || 'WhereTo could not build that itinerary. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError('');
    try {
      await clearItinerary();
    } catch {
      setError('That itinerary could not be removed. Check your connection and try again.');
    }
  };

  return (
    <section className="trip-itinerary" aria-labelledby="trip-itinerary-title">
      <TripExtension trip={trip} />
      <div className="trip-itinerary__intro">
        <div>
          <h2 id="trip-itinerary-title">Build your itinerary</h2>
          <p>WhereTo will arrange the places you saved into a simple daily plan. It only uses places already in this trip.</p>
        </div>
        <Sparkles size={24} aria-hidden="true" />
      </div>

      <div className="trip-itinerary__controls">
        <label>
          <span>Days</span>
          <select value={dayCount} onChange={(event) => setDayCount(Number(event.target.value))} disabled={busy}>
            {Array.from({ length: 7 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <fieldset disabled={busy}>
          <legend>Pace</legend>
          <div>
            {paceOptions.map((option) => (
              <button key={option.value} className={pace === option.value ? 'is-active' : ''} type="button" onClick={() => setPace(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <button className="primary-button trip-itinerary__build" type="button" onClick={build} disabled={!canBuild || busy}>
          {busy ? <><RefreshCw className="trip-itinerary__spinner" size={16} />Building your days…</> : <><Sparkles size={16} />{itinerary ? 'Regenerate' : 'Build my itinerary'}</>}
        </button>
      </div>

      {!canBuild ? <p className="trip-itinerary__hint">Save at least two activities to build an itinerary.</p> : null}
      {error ? <div className="trip-itinerary__error" role="alert"><strong>The itinerary did not finish.</strong><span>{error}</span><button type="button" onClick={build}>Try again</button></div> : null}

      {itinerary ? (
        <div className="trip-itinerary__result">
          <header>
            <div>
              <span><CalendarDays size={14} />{itinerary.dayCount} {itinerary.dayCount === 1 ? 'day' : 'days'} · {itinerary.pace}</span>
              <h3>{itinerary.title}</h3>
              <p>{itinerary.summary}</p>
            </div>
            <button type="button" onClick={remove} aria-label="Remove itinerary"><Trash2 size={16} />Clear</button>
          </header>
          <div className="trip-itinerary__days">
            {itinerary.days?.map((day) => (
              <article key={day.day} className="trip-itinerary__day">
                <div className="trip-itinerary__day-heading">
                  <span>Day {day.day}</span>
                  <div><h4>{day.title}</h4><p>{day.note}</p></div>
                </div>
                <div className="trip-itinerary__stops">
                  {day.stops?.map((stop) => <ItineraryStop key={stop.placeId} stop={stop} place={placeById.get(stop.placeId)} />)}
                  {!day.stops?.length ? <p className="trip-itinerary__open-day">An open day for something spontaneous.</p> : null}
                </div>
              </article>
            ))}
          </div>
          <p className="trip-itinerary__disclaimer">A flexible starting point—confirm current hours and reservations before you go.</p>
        </div>
      ) : null}
    </section>
  );
}
