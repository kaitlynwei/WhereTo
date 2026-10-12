import { useEffect, useState } from 'react';
import { applyDistanceFromStay, fetchWalkingTimesFromStay } from '../lib/googleMaps';
import { walkingTimesErrorMessage } from '../lib/walkingTimes';

export function useWalkingTimes(places, stay) {
  const [state, setState] = useState({ places, loading: false, error: '' });

  useEffect(() => {
    let active = true;
    const fallback = applyDistanceFromStay(places, stay);

    if (!stay?.coordinates || !places.length) {
      setState({ places: fallback, loading: false, error: '' });
      return () => { active = false; };
    }

    setState({ places: fallback, loading: true, error: '' });
    fetchWalkingTimesFromStay(places, stay)
      .then((routedPlaces) => {
        if (active) setState({ places: routedPlaces, loading: false, error: '' });
      })
      .catch((routeError) => {
        if (active) {
          setState({
            places: fallback,
            loading: false,
            error: walkingTimesErrorMessage(routeError),
          });
        }
      });

    return () => { active = false; };
  }, [places, stay]);

  return state;
}
