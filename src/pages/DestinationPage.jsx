import { MapPin, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdvisorConversation } from '../components/AdvisorConversation';
import { AttractionCard } from '../components/AttractionCard';
import { PlacesMap } from '../components/PlacesMap';
import { SiteLayout } from '../components/SiteLayout';
import { StayPicker } from '../components/StayPicker';
import { useTrip } from '../context/TripContext';
import { findDestinationGuide } from '../data/destinationGuides';
import { useDestinationPlaces } from '../hooks/useDestinationPlaces';
import { useStay } from '../hooks/useStay';
import { useWalkingTimes } from '../hooks/useWalkingTimes';
import { searchStayPlaces } from '../lib/googleMaps';
import { rankDestinationPlaces } from '../lib/placeRanking';
import { savedGooglePlace } from '../lib/savedPlaces';

const categories = ['Top things to do', 'Food & drink', 'Culture', 'Outdoors', 'Shopping'];
const filterDefinitions = [
  { label: 'Free', supports: (place) => Boolean(place.price), matches: (place) => place.price === 'Free' },
  {
    label: 'Within 30 min',
    supports: (place) => Number.isFinite(place.walkingMinutes) || Number.isFinite(place.distanceMiles),
    matches: (place) => Number.isFinite(place.walkingMinutes)
      ? place.walkingMinutes <= 30
      : place.distanceMiles <= 2,
  },
];

function readableDestination(slug) {
  return slug.split('-').filter(Boolean).map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join(' ');
}

export function DestinationPage({
  savedIds,
  pendingIds,
  toggleSaved,
  destinationSlug,
  cityName,
  tripId = '',
  stay: initialStay,
  tripPreferences,
}) {
  const knownGuide = findDestinationGuide(cityName || destinationSlug);
  const cityQuery = cityName || knownGuide?.displayName || readableDestination(destinationSlug);
  const guide = knownGuide ?? {
    id: destinationSlug,
    displayName: cityQuery,
    name: cityQuery,
    country: '',
    image: '',
    description: `A live guide to the places that give ${cityQuery} its character.`,
  };
  const [activeCategory, setActiveCategory] = useState('Top things to do');
  const [activeFilters, setActiveFilters] = useState([]);
  const [selectedAttraction, setSelectedAttraction] = useState(null);
  const [aiPlaces, setAiPlaces] = useState(null);
  const [staySearchSeed, setStaySearchSeed] = useState('');
  const resolvedInitialStay = useRef(false);
  const dataCategory = activeCategory === 'For you' ? 'Top things to do' : activeCategory;
  const {
    stay, loading: stayLoading, error: stayError, notice: stayNotice, saveStay, clearStay, persistedToAccount,
  } = useStay(destinationSlug, cityQuery);
  const { places, city, center, viewport, loading, error, retry } = useDestinationPlaces(cityQuery, dataCategory, guide.image, stay);
  const displayName = city?.name || guide.displayName;
  const { activateDestinationTrip } = useTrip();
  const locationLabel = city?.address || [guide.name, guide.country].filter(Boolean).join(', ');
  const sourcePlaces = aiPlaces ?? places;
  const { places: proximityPlaces, loading: walkingTimesLoading, error: walkingTimesError } = useWalkingTimes(sourcePlaces, stay);
  const rankedPlaces = useMemo(() => rankDestinationPlaces(proximityPlaces, {
    tripPreferences,
    hasStay: Boolean(stay?.coordinates),
  }), [proximityPlaces, stay?.coordinates, tripPreferences]);

  useEffect(() => {
    setActiveCategory('Top things to do');
    setActiveFilters([]);
    setSelectedAttraction(null);
    setAiPlaces(null);
    resolvedInitialStay.current = false;
  }, [cityQuery]);

  useEffect(() => {
    activateDestinationTrip({ id: destinationSlug, name: displayName, country: guide.country }, tripId);
  }, [activateDestinationTrip, destinationSlug, displayName, guide.country, tripId]);

  useEffect(() => {
    if (!initialStay || stay || stayLoading || resolvedInitialStay.current) return;
    resolvedInitialStay.current = true;
    searchStayPlaces({ cityName: cityQuery, query: initialStay })
      .then((results) => { if (results[0]) saveStay(results[0]); })
      .catch(() => setStaySearchSeed(initialStay));
  }, [cityQuery, initialStay, saveStay, stay, stayLoading]);

  useEffect(() => {
    setSelectedAttraction((current) => rankedPlaces.some((place) => place.id === current) ? current : null);
    setActiveFilters((current) => current.filter((label) => {
      const definition = filterDefinitions.find((filter) => filter.label === label);
      return definition && rankedPlaces.some(definition.supports);
    }));
  }, [rankedPlaces]);

  const availableFilters = filterDefinitions.filter((filter) => rankedPlaces.some(filter.supports));
  const visibleAttractions = useMemo(() => rankedPlaces.filter((place) => activeFilters.every((filter) => (
    filterDefinitions.find((definition) => definition.label === filter)?.matches(place) ?? true
  ))), [activeFilters, rankedPlaces]);
  const tabs = aiPlaces ? ['For you', ...categories] : categories;
  const orderDescription = stay
    ? 'Top-rated, widely reviewed, and convenient from your stay'
    : 'Top-rated and widely reviewed, shaped by your interests';

  const toggleFilter = (filter) => setActiveFilters((current) => (
    current.includes(filter) ? current.filter((item) => item !== filter) : [...current, filter]
  ));

  const handleCategory = (category) => {
    if (category !== 'For you') setAiPlaces(null);
    setActiveCategory(category);
    setActiveFilters([]);
  };

  const handleRecommendations = (recommended) => {
    setAiPlaces(recommended);
    setActiveCategory('For you');
    setActiveFilters([]);
  };

  const saveGuide = { ...guide, displayName, name: displayName };

  return (
    <SiteLayout savedCount={savedIds.length}>
      <header className="destination-hero">
        <a className="back-link" href="#search">← Search another place</a>
        <div className="destination-hero__title">
          <div><h1>{displayName}</h1><p>{guide.description}</p></div>
          <span><MapPin size={16} />{locationLabel}</span>
        </div>
      </header>

      <div className="destination-tools">
        <StayPicker cityName={displayName} stay={stay} loading={stayLoading} error={stayError} notice={stayNotice} onSave={saveStay} onClear={clearStay} persistedToAccount={persistedToAccount} searchSeed={staySearchSeed} />
        <AdvisorConversation mode="destination" destination={displayName} places={rankedPlaces} stay={stay} fallbackImage={guide.image} onRecommendations={handleRecommendations} onNeighborhoodPick={setStaySearchSeed} />
      </div>

      <div className="category-tabs" role="tablist" aria-label="Explore by category">
        {tabs.map((category) => (
          <button type="button" role="tab" aria-selected={activeCategory === category} className={activeCategory === category ? 'is-active' : ''} key={category} onClick={() => handleCategory(category)}>{category}</button>
        ))}
      </div>
      <div className="place-controls">
        <div className="place-controls__ranking">
          <strong>Recommended for you</strong>
          <span>{orderDescription}</span>
        </div>
        {availableFilters.length ? (
          <div className="filter-bar" aria-label="Place filters">
            <span>Refine</span>
            {availableFilters.map((filter) => <button type="button" aria-pressed={activeFilters.includes(filter.label)} className={activeFilters.includes(filter.label) ? 'is-active' : ''} key={filter.label} onClick={() => toggleFilter(filter.label)}>{filter.label}</button>)}
          </div>
        ) : null}
      </div>
      {stay ? (
        <p className={`walking-status${walkingTimesError ? ' walking-status--fallback' : ''}`} aria-live="polite">
          {walkingTimesLoading ? 'Calculating walks from your stay…' : walkingTimesError || 'Walking times are based on your saved stay.'}
        </p>
      ) : null}

      <div className="explore-split">
        <section className="attraction-list" aria-label={`${activeCategory} attractions`}>
          <div className="list-heading">
            <div><h2>{activeCategory}</h2><p>{loading && !aiPlaces ? 'Finding live places…' : `${visibleAttractions.length} places from Google`}</p></div>
          </div>

          {loading && !aiPlaces ? Array.from({ length: 4 }, (_, index) => (
            <div className="attraction-skeleton" aria-hidden="true" key={index}><span /><div><i /><i /><i /></div></div>
          )) : null}

          {!loading && error && !aiPlaces ? (
            <div className="filter-empty filter-empty--error"><RefreshCw aria-hidden="true" /><h3>Live places could not load</h3><p>{error}</p><button type="button" onClick={retry}>Try again</button></div>
          ) : null}

          {(!loading || aiPlaces) && (!error || aiPlaces) ? visibleAttractions.map((attraction) => (
            <AttractionCard
              key={attraction.id}
              attraction={attraction}
              selected={selectedAttraction === attraction.id}
              isSaved={savedIds.includes(attraction.id)}
              isSaving={pendingIds.includes(attraction.id)}
              onSelect={() => setSelectedAttraction((current) => current === attraction.id ? null : attraction.id)}
              onToggleSaved={() => toggleSaved(savedGooglePlace(attraction, saveGuide))}
            />
          )) : null}

          {(!loading || aiPlaces) && (!error || aiPlaces) && visibleAttractions.length === 0 ? (
            <div className="filter-empty"><h3>No places match those filters</h3><p>Remove a filter to see the complete live list.</p><button type="button" onClick={() => setActiveFilters([])}>Clear filters</button></div>
          ) : null}
        </section>
        <PlacesMap places={visibleAttractions} selectedId={selectedAttraction} onSelect={setSelectedAttraction} destinationName={displayName} center={stay?.coordinates ?? center} viewport={viewport} loading={loading && !aiPlaces} error={aiPlaces ? '' : error} stay={stay} />
      </div>
    </SiteLayout>
  );
}
