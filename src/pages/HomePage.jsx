import { useMemo, useState } from 'react';
import { ArrowUpRight, Compass, Search } from 'lucide-react';
import { DestinationCard } from '../components/DestinationCard';
import { DestinationPhoto } from '../components/DestinationPhoto';
import { SiteLayout } from '../components/SiteLayout';
import { usePreferences } from '../context/PreferencesContext';
import { destinationGuides } from '../data/destinationGuides';
import { dailyDestinationSelection, discoveryDestinationDeck } from '../lib/destinationDiscovery';
import { destinationHref } from '../lib/navigation';
import { savedDestination } from '../lib/savedPlaces';

const destinationId = (name) => `destination-${name.toLowerCase().replaceAll(' ', '-')}`;

export function HomePage({ savedIds, pendingIds, toggleSaved, tripPreferences }) {
  const [visibleCount, setVisibleCount] = useState(9);
  const [shuffleRound, setShuffleRound] = useState(0);
  const {
    preferences,
    preferenceById,
    pendingIds: preferencePendingIds,
    error: preferenceError,
    setDestinationPreference,
  } = usePreferences();
  const dailyDestinations = useMemo(() => dailyDestinationSelection(destinationGuides, {
    preferences,
    tripPreferences,
    count: 3,
  }), [preferences, tripPreferences]);
  const discoveryDeck = useMemo(() => discoveryDestinationDeck(destinationGuides, {
    preferences,
    tripPreferences,
    shuffleKey: shuffleRound,
  }), [preferences, shuffleRound, tripPreferences]);
  const visibleDestinations = discoveryDeck.slice(0, visibleCount);
  const hasMore = visibleCount < discoveryDeck.length;

  const continueDiscovering = () => {
    if (hasMore) {
      setVisibleCount((current) => Math.min(current + 6, discoveryDeck.length));
      return;
    }
    setShuffleRound((current) => current + 1);
    setVisibleCount(9);
    window.requestAnimationFrame(() => document.getElementById('popular')?.scrollIntoView({ behavior: 'smooth' }));
  };

  return (
    <SiteLayout savedCount={savedIds.length}>
      <section className="home-discovery" aria-labelledby="hero-title">
        <div className="home-discovery__intro">
          <h1 id="hero-title">Where do you want to go?</h1>
          <p>Start with a destination—or tell us the kind of trip you want and let WhereTo narrow it down.</p>
          <div className="home-discovery__actions" aria-label="Choose how to begin">
            <a href="#choose">
              <Compass size={23} aria-hidden="true" />
              <span><strong>Help me explore</strong><small>Choose a feeling, budget, and pace.</small></span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
            <a href="#search">
              <Search size={22} aria-hidden="true" />
              <span><strong>I know where I’m going</strong><small>Search any city and see what is worth your time.</small></span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </div>
          <a className="home-discovery__advisor" href="#advisor">Or describe the trip in your own words <ArrowUpRight size={15} /></a>
        </div>
        <div className="home-featured">
          <div className="home-featured__heading">
            <h2>Three places to start</h2>
            <p>Fresh each day, shaped by what you like.</p>
          </div>
          <div className="home-featured__grid">
            {dailyDestinations.map((destination, index) => (
              <figure className={`home-featured__place home-featured__place--${index + 1}`} key={destination.id}>
                <a href={destinationHref(destination.id, { city: destination.searchName || destination.name })} aria-label={`Explore ${destination.name}`}>
                  <DestinationPhoto destination={destination} loading={index === 0 ? 'eager' : 'lazy'} />
                  <figcaption>
                    <span><strong>{destination.name}</strong><small>{destination.country}</small></span>
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </figcaption>
                </a>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="popular" id="popular" aria-labelledby="popular-title">
        <div className="section-heading">
          <div>
            <h2 id="popular-title">Keep discovering</h2>
            <p>React as you browse. Interested places and similar destinations rise; “Not for me” moves lower without disappearing.</p>
          </div>
        </div>
        <div className="discovery-status" aria-live="polite">
          <span>Showing {visibleDestinations.length} of {discoveryDeck.length}</span>
          <span>{preferences.length ? `${preferences.length} reactions shaping this order` : 'Your reactions will personalize this order'}</span>
        </div>
        {preferenceError ? <p className="preference-message">{preferenceError}</p> : null}
        <div className="destination-grid">
          {visibleDestinations.map((destination) => {
            const id = destinationId(destination.name);
            return (
              <DestinationCard
                key={destination.name}
                destination={destination}
                isSaved={savedIds.includes(id)}
                isSaving={pendingIds.includes(id)}
                preference={preferenceById[destination.id]?.signal ?? 'neutral'}
                preferencePending={preferencePendingIds.includes(destination.id)}
                onToggleSaved={() => toggleSaved(savedDestination(destination))}
                onPreferenceChange={(signal) => setDestinationPreference(destination, signal)}
                onExplore={() => { window.location.hash = destinationHref(destination.name).slice(1); }}
              />
            );
          })}
        </div>
        <button className="discovery-more" type="button" onClick={continueDiscovering}>
          <span>{hasMore ? 'Load 6 more places' : 'Shuffle and keep exploring'}</span>
          <small>{hasMore ? `${discoveryDeck.length - visibleCount} still in this round` : 'A fresh order, still shaped by you'}</small>
        </button>
      </section>
    </SiteLayout>
  );
}
