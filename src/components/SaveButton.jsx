import { Bookmark } from 'lucide-react';

export function SaveButton({ isSaved, onClick, label, className = '', disabled = false }) {
  return (
    <button
      className={`save-control${isSaved ? ' save-control--saved' : ''}${className ? ` ${className}` : ''}`}
      type="button"
      aria-pressed={isSaved}
      aria-label={isSaved ? `Remove ${label} from saved places` : `Save ${label}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Bookmark size={17} fill={isSaved ? 'currentColor' : 'none'} aria-hidden="true" />
      <span>{isSaved ? 'Saved' : 'Save'}</span>
    </button>
  );
}
