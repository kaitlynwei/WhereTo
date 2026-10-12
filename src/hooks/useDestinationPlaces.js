import { useEffect, useState } from 'react';
import { searchDestinationPlaces } from '../lib/googleMaps';

export function useDestinationPlaces(cityName, category, fallbackImage, stay = null) {
  const [state, setState] = useState({ places: [], city: null, center: null, viewport: null, loading: true, error: '' });
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: '' }));

    searchDestinationPlaces({ cityName, category, fallbackImage, stay })
      .then((result) => {
        if (active) setState({ ...result, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) setState((current) => ({ ...current, places: [], loading: false, error: error.message }));
      });

    return () => { active = false; };
  }, [category, cityName, fallbackImage, retryKey, stay?.coordinates?.lat, stay?.coordinates?.lng, stay?.id]);

  return { ...state, retry: () => setRetryKey((current) => current + 1) };
}
