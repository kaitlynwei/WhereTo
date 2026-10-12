import { Bookmark } from 'lucide-react';
import { DestinationPhoto } from './DestinationPhoto';
import { DestinationPreferenceControl } from './DestinationPreferenceControl';

export function DestinationCard({
  destination,
  isSaved,
  isSaving = false,
  preference = 'neutral',
  preferencePending = false,
  onToggleSaved,
  onExplore,
  onPreferenceChange,
}) {
  const { name, country, categories, position } = destination;

  return (
    <article className="destination-card">
      <button className="destination-card__content" type="button" onClick={onExplore} aria-label={`Explore ${name}`}>
        <div className="destination-card__image-wrap">
          <DestinationPhoto
            destination={destination}
            className="destination-card__image"
            style={{ objectPosition: position }}
          />
        </div>
        <div className="destination-card__body">
          <div>
            <h3>{name}</h3>
            <p>{country}</p>
          </div>
          <div className="destination-card__tags" aria-label="Travel categories">
            {categories.map((category) => <span key={category}>{category}</span>)}
          </div>
        </div>
      </button>
      {onPreferenceChange ? (
        <DestinationPreferenceControl
          destinationName={name}
          value={preference}
          pending={preferencePending}
          onChange={onPreferenceChange}
        />
      ) : null}
      <button
        className={`save-button${isSaved ? ' save-button--saved' : ''}`}
        type="button"
        aria-label={isSaved ? `Remove ${name} from saved destinations` : `Save ${name}`}
        aria-pressed={isSaved}
        onClick={onToggleSaved}
        disabled={isSaving}
      >
        <Bookmark aria-hidden="true" size={18} fill={isSaved ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
