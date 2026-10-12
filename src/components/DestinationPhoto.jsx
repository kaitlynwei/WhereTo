import { useDestinationPreview } from '../hooks/useDestinationPreview';

export function DestinationPhoto({ destination, className = '', loading = 'lazy', style }) {
  const preview = useDestinationPreview(destination);

  if (!preview.image) {
    return (
      <span className={`destination-photo__placeholder${preview.loading ? ' is-loading' : ''}`} aria-label={preview.imageAlt}>
        <span>{preview.loading ? 'Finding a local view…' : destination.name}</span>
      </span>
    );
  }

  return (
    <>
      <img
        className={className}
        src={preview.image}
        alt={preview.imageAlt}
        loading={loading}
        style={style}
      />
      {preview.photoAttributions.length ? (
        <span className="destination-photo__credit">Photo: {preview.photoAttributions[0].name}</span>
      ) : null}
    </>
  );
}
