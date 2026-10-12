import { ArrowRight, Check } from 'lucide-react';
import { RouteHeader } from '../components/RouteHeader';
import { SiteLayout } from '../components/SiteLayout';
import { interests } from '../data/prototypeData';

const options = {
  budget: ['Thoughtful', 'Comfortable', 'Go all out'],
  weather: ['Warm', 'Cool', 'No preference'],
  pace: ['Slow', 'Balanced', 'Full days'],
};

export function ChoosePage({ savedCount, tripPreferences, setTripPreferences }) {
  const selected = tripPreferences.interests;
  const preferences = tripPreferences;

  const toggleInterest = (interest) => setTripPreferences((current) => ({
    ...current,
    interests: current.interests.includes(interest)
      ? current.interests.filter((item) => item !== interest)
      : [...current.interests, interest],
  }));

  return (
    <SiteLayout savedCount={savedCount}>
      <RouteHeader
        title="What sounds good right now?"
        description="Choose a few instincts. This should take less than a minute."
      />

      <section className="preference-section" aria-labelledby="interests-title">
        <div className="preference-heading">
          <h2 id="interests-title">Pick what pulls you in</h2>
          <span>{selected.length} selected</span>
        </div>
        <div className="interest-grid">
          {interests.map((interest) => {
            const active = selected.includes(interest);
            return (
              <button
                className={`interest-card${active ? ' interest-card--active' : ''}`}
                type="button"
                key={interest}
                aria-pressed={active}
                onClick={() => toggleInterest(interest)}
              >
                <span>{interest}</span>
                {active ? <Check size={17} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="preference-controls" aria-label="Trip preferences">
        {Object.entries(options).map(([key, values]) => (
          <fieldset className="preference-control" key={key}>
            <legend>{key}</legend>
            <div className="segmented-control">
              {values.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={preferences[key] === value ? 'is-active' : ''}
                  aria-pressed={preferences[key] === value}
                  onClick={() => setTripPreferences((current) => ({ ...current, [key]: value }))}
                >
                  {value}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
      </section>

      <div className="flow-action">
        <div><span>Your direction</span><strong>{selected.slice(0, 3).join(' · ') || 'Open to anything'}</strong></div>
        <div className="flow-action__choices"><a className="text-link" href="#advisor">Talk it through</a><a className="primary-button" href="#recommendations">Show me places <ArrowRight size={17} aria-hidden="true" /></a></div>
      </div>
    </SiteLayout>
  );
}
