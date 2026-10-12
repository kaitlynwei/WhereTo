import { useEffect, useState } from 'react';
import { fetchGooglePlace } from '../lib/googleMaps';

export function useSavedPlaceDetails(savedPlaces) {
  const [state, setState] = useState({ places: savedPlaces, loading: false });

  useEffect(() => {
    let active = true;
    const googlePlaces = savedPlaces.filter((place) => place.type === 'google-place');
    if (!googlePlaces.length) {
      setState({ places: savedPlaces, loading: false });
      return undefined;
    }

    setState({ places: savedPlaces, loading: true });
    Promise.all(googlePlaces.map(async (saved) => {
      try {
        const live = await fetchGooglePlace(saved.placeId ?? saved.id);
        return { ...saved, ...live, id: saved.id, href: saved.href };
      } catch {
        return {
          ...saved,
          name: saved.name ?? 'Saved place',
          image: saved.image ?? '',
          category: saved.category ?? 'Google place',
          detailsUnavailable: true,
        };
      }
    })).then((hydrated) => {
      if (!active) return;
      const byId = new Map(hydrated.map((place) => [place.id, place]));
      setState({ places: savedPlaces.map((place) => byId.get(place.id) ?? place), loading: false });
    });

    return () => { active = false; };
  }, [savedPlaces]);

  return state;
}
