import { LoaderCircle, MapPin, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RouteHeader } from '../components/RouteHeader';
import { SiteLayout } from '../components/SiteLayout';
import { useDestinationAutocomplete } from '../hooks/useDestinationAutocomplete';
import { destinationHref } from '../lib/navigation';

const suggestions = ['New York City', 'Tokyo', 'Barcelona', 'Paris'];

export function SearchPage({ savedCount }) {
  const [destination, setDestination] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const { suggestions: liveSuggestions, loading, error, selectingId, selectSuggestion } = useDestinationAutocomplete(destination);
  const hasInput = Boolean(destination.trim());

  useEffect(() => { setActiveIndex(0); }, [destination, liveSuggestions.length]);

  const openDestination = (name, city = name) => {
    window.location.hash = destinationHref(name, { city }).slice(1);
  };

  const handleSuggestion = async (suggestion) => {
    const resolved = await selectSuggestion(suggestion);
    if (resolved?.name) openDestination(resolved.name, resolved.address || suggestion.fullText);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' && liveSuggestions.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % liveSuggestions.length);
    } else if (event.key === 'ArrowUp' && liveSuggestions.length) {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + liveSuggestions.length) % liveSuggestions.length);
    } else if (event.key === 'Enter' && hasInput) {
      event.preventDefault();
      if (liveSuggestions[activeIndex]) handleSuggestion(liveSuggestions[activeIndex]);
      else if (!loading) openDestination(destination.trim());
    } else if (event.key === 'Escape') {
      setDestination('');
    }
  };

  return (
    <SiteLayout savedCount={savedCount}>
      <RouteHeader
        title="Take me somewhere specific"
        description="Start typing a city, then choose it from the live suggestions. You can add where you are staying on the destination page."
      />
      <section className="destination-search" aria-labelledby="destination-search-title">
        <h2 id="destination-search-title">Where are you going?</h2>
        <div className="destination-autocomplete">
          <label className="search-field">
            <Search size={24} aria-hidden="true" />
            <span className="sr-only">Destination</span>
            <input
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Try New York City, Barcelona, or Tokyo"
              autoComplete="off"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={hasInput}
              aria-controls="destination-suggestions"
              aria-activedescendant={liveSuggestions[activeIndex] ? `destination-option-${activeIndex}` : undefined}
            />
            {loading ? <LoaderCircle className="autocomplete-spinner" size={20} aria-label="Finding cities" /> : null}
          </label>

          {hasInput ? (
            <div className="destination-autocomplete__panel" id="destination-suggestions">
              {liveSuggestions.length ? (
                <div className="destination-autocomplete__list" role="listbox" aria-label="City suggestions">
                  {liveSuggestions.map((suggestion, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      className={activeIndex === index ? 'is-active' : ''}
                      id={`destination-option-${index}`}
                      key={suggestion.id}
                      disabled={Boolean(selectingId)}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => handleSuggestion(suggestion)}
                    >
                      <MapPin size={17} aria-hidden="true" />
                      <span><strong>{suggestion.name}</strong>{suggestion.secondaryText ? <small>{suggestion.secondaryText}</small> : null}</span>
                      {selectingId === suggestion.id ? <LoaderCircle className="autocomplete-spinner" size={17} aria-label="Opening city" /> : <em>Open</em>}
                    </button>
                  ))}
                  <small className="destination-autocomplete__google">Powered by Google</small>
                </div>
              ) : !loading ? (
                <button className="destination-autocomplete__fallback" type="button" onClick={() => openDestination(destination.trim())}>
                  <Search size={17} aria-hidden="true" /> Search for “{destination.trim()}”
                </button>
              ) : null}
              {error ? <p className="destination-autocomplete__error" role="status">{error}</p> : null}
            </div>
          ) : null}
        </div>
        <div className="suggestion-row" aria-label="Sample destinations">
          <span>Popular</span>
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion} onClick={() => openDestination(suggestion)}>{suggestion}</button>
          ))}
        </div>
      </section>
      <aside className="search-sample-note"><span>Live discovery</span><p>Choose a city and WhereTo will open its current attractions, food, culture, outdoor places, and shopping immediately.</p></aside>
    </SiteLayout>
  );
}
