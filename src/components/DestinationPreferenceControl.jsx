import { Heart, Minus, ThumbsDown } from 'lucide-react';

const choices = [
  { value: 'interested', label: 'Interested', Icon: Heart },
  { value: 'neutral', label: 'Neutral', Icon: Minus },
  { value: 'not-interested', label: 'Not for me', Icon: ThumbsDown },
];

export function DestinationPreferenceControl({ destinationName, value = 'neutral', pending = false, onChange }) {
  return (
    <div className="destination-preference" role="group" aria-label={`Your preference for ${destinationName}`}>
      {choices.map(({ value: choice, label, Icon }) => (
        <button
          type="button"
          key={choice}
          className={value === choice ? 'is-active' : ''}
          aria-pressed={value === choice}
          disabled={pending}
          onClick={() => onChange(choice)}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
