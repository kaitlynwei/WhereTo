import { useMemo, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { DestinationPreferenceControl } from '../components/DestinationPreferenceControl';
import { RouteHeader } from '../components/RouteHeader';
import { SiteLayout } from '../components/SiteLayout';
import { usePreferences } from '../context/PreferencesContext';
import { recommendations } from '../data/prototypeData';
import { discoveryDestinationDeck } from '../lib/destinationDiscovery';
import { destinationHref } from '../lib/navigation';

function describeMatch(place, tripPreferences) {
  const matchingInterests = place.categories.filter((category) => tripPreferences.interests.includes(category));
  const interestText = matchingInterests.length
    ? `It overlaps with your interest in ${matchingInterests.join(' and ').toLowerCase()}.`
    : `It adds a different angle to your shortlist through ${place.categories.slice(0, 2).join(' and ').toLowerCase()}.`;
  const weatherText = tripPreferences.weather === 'No preference'
    ? 'You left the weather open.'
    : `This sample frames it as a ${tripPreferences.weather.toLowerCase()}-weather trip.`;
  const paceText = {
    Slow: 'The itinerary would favor fewer stops and longer stays.',
    Balanced: 'The itinerary would mix planned highlights with open time.',
    'Full days': 'The itinerary would make room for full, active days.',
  }[tripPreferences.pace];
  const budgetText = {
    Thoughtful: 'Suggestions would lean toward value-conscious choices.',
    Comfortable: 'Suggestions would balance special moments with everyday options.',
    'Go all out': 'Suggestions would leave room for standout splurges.',
  }[tripPreferences.budget];

  return `${interestText} ${weatherText} ${paceText} ${budgetText}`;
}

export function RecommendationsPage({ savedCount, tripPreferences }) {
  const [visibleCount, setVisibleCount] = useState(8);
  const [shuffleRound, setShuffleRound] = useState(0);
  const {
    preferences,
    preferenceById,
    pendingIds,
    error,
    setDestinationPreference,
  } = usePreferences();
  const rankedRecommendations = useMemo(() => (
    discoveryDestinationDeck(recommendations, { preferences, tripPreferences, shuffleKey: shuffleRound })
  ), [preferences, shuffleRound, tripPreferences]);
  const visibleRecommendations = rankedRecommendations.slice(0, visibleCount);
  const preferenceSummary = [
    ...tripPreferences.interests.slice(0, 2),
    tripPreferences.weather,
    `${tripPreferences.pace.toLowerCase()} pace`,
  ].join(', ');
  const hasMore = visibleCount < rankedRecommendations.length;

  const continueDiagnostic = () => {
    if (hasMore) {
      setVisibleCount((current) => Math.min(current + 4, rankedRecommendations.length));
      return;
    }
    setShuffleRound((current) => current + 1);
    setVisibleCount(8);
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  };
  return (
    <SiteLayout savedCount={savedCount}>
      <RouteHeader
        backHref="#choose"
        title="Places that fit your pace"
        description={`A balanced shortlist shaped around ${preferenceSummary}, mixing world favorites, cities gaining momentum, and a few thoughtful alternatives.`}
      />
      <div className="recommendation-summary" aria-live="polite">
        <span>Showing {visibleRecommendations.length} of {rankedRecommendations.length} destinations</span>
        <span>Your reactions reshape the order.</span>
      </div>
      {error ? <p className="preference-message">{error}</p> : null}
      <div className="recommendation-list">
        {visibleRecommendations.map((place, index) => (
          <article className="recommendation" key={place.id}>
            <div className="recommendation__image-wrap">
              <DestinationPhoto destination={place} />
            </div>
            <div className="recommendation__body">
              <div className="recommendation__topline">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <span>{place.preferenceSignal === 'not-interested'
                  ? 'Moved lower · still available'
                  : `${place.discoveryGroup === 'iconic' ? 'World favorite' : place.discoveryGroup === 'trending' ? 'Trending now' : 'Worth a look'}${place.price ? ` · ${place.price}` : ''}`}</span>
              </div>
              <h2>{place.name}</h2>
              <p className="location-line"><MapPin size={15} aria-hidden="true" />{place.country}</p>
              <p className="recommendation__description">{place.description}</p>
              <div className="tag-list">{place.categories.map((category) => <span key={category}>{category}</span>)}</div>
              <div className="match-note"><strong>Why this matches you</strong><p>{describeMatch(place, tripPreferences)}</p></div>
              <div className="experience-list">
                <span>Preview</span>
                {place.experiences.map((experience) => <span key={experience}>{experience}</span>)}
              </div>
              <DestinationPreferenceControl
                destinationName={place.name}
                value={preferenceById[place.id]?.signal ?? 'neutral'}
                pending={pendingIds.includes(place.id)}
                onChange={(signal) => setDestinationPreference(place, signal)}
              />
              <a className="text-link" href={destinationHref(place.id)}>
                Explore {place.name} <ArrowRight size={16} aria-hidden="true" />
              </a>
            </div>
          </article>
        ))}
      </div>
      <button className="recommendation-more" type="button" onClick={continueDiagnostic}>
        {hasMore ? 'Show 4 more destinations' : 'Shuffle and keep exploring'}
        <span>{hasMore ? `${rankedRecommendations.length - visibleCount} still to explore` : 'A fresh order, still shaped by your reactions'}</span>
      </button>
    </SiteLayout>
  );
}
