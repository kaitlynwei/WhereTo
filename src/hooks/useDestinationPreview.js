import { useEffect, useState } from 'react';
import { fetchDestinationPreview } from '../lib/googleMaps';

const previewCache = new Map();

export function useDestinationPreview(destination) {
  const query = destination.searchName || [destination.name, destination.country].filter(Boolean).join(', ');
  const [state, setState] = useState(() => ({
    image: destination.image || '',
    imageAlt: `${destination.name}, ${destination.country}`,
    photoAttributions: [],
    loading: !destination.image,
  }));

  useEffect(() => {
    let active = true;
    if (destination.image) {
      setState({ image: destination.image, imageAlt: `${destination.name}, ${destination.country}`, photoAttributions: [], loading: false });
      return undefined;
    }

    setState((current) => ({ ...current, loading: true }));
    const cacheKey = `${query}::${destination.photoQuery || ''}`;
    const request = previewCache.get(cacheKey) ?? fetchDestinationPreview(query, destination.photoQuery);
    previewCache.set(cacheKey, request);
    request.then((preview) => {
      if (active) setState({ ...preview, loading: false });
    }).catch(() => {
      previewCache.delete(cacheKey);
      if (active) setState({ image: '', imageAlt: destination.name, photoAttributions: [], loading: false });
    });

    return () => { active = false; };
  }, [destination.country, destination.image, destination.name, destination.photoQuery, query]);

  return state;
}
