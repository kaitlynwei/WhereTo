import { Compass, MapPin, MessageCircleMore } from 'lucide-react';
import { AdvisorConversation } from '../components/AdvisorConversation';
import { SiteLayout } from '../components/SiteLayout';

export function TravelAdvisorPage({ savedCount, tripPreferences }) {
  return (
    <SiteLayout active="advisor" savedCount={savedCount}>
      <section className="advisor-page" aria-labelledby="advisor-title">
        <header className="advisor-page__header">
          <a className="back-link" href="#home">← Back to explore</a>
          <h1 id="advisor-title">Tell us the trip you have in mind.</h1>
          <p>You do not need a destination—or the right search words. Start with a feeling, a constraint, or the kind of day you want to have.</p>
        </header>
        <div className="advisor-page__layout">
          <AdvisorConversation mode="discovery" preferences={tripPreferences} />
          <aside className="advisor-page__notes" aria-label="What WhereTo can help with">
            <div><Compass size={19} /><h2>Choose a destination</h2><p>Compare a small set of places against the priorities you actually care about.</p></div>
            <div><MapPin size={19} /><h2>Choose an area</h2><p>Find a neighborhood that fits your pace without turning the search into hotel shopping.</p></div>
            <div><MessageCircleMore size={19} /><h2>Refine naturally</h2><p>Ask for cheaper, quieter, closer, more local, or less museum-heavy options.</p></div>
          </aside>
        </div>
      </section>
    </SiteLayout>
  );
}
