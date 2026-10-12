import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import { fetchStayPlace } from '../lib/googleMaps';

const localKey = (destinationId) => `whereto-stay-${destinationId}`;

export function useStay(destinationId, destinationName = '') {
  const { user, loading: authLoading } = useAuth();
  const {
    trip,
    loading: tripLoading,
    error: tripError,
    saveStay: saveTripStay,
    clearStay: clearTripStay,
  } = useTrip();
  const [deviceStay, setDeviceStay] = useState(null);
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [error, setError] = useState('');
  const accountStay = trip?.stay?.destinationId === destinationId ? trip.stay : null;

  useEffect(() => {
    let active = true;
    if (authLoading || user) {
      setDeviceLoading(false);
      return undefined;
    }
    const placeId = window.localStorage.getItem(localKey(destinationId));
    if (!placeId) {
      setDeviceStay(null);
      setDeviceLoading(false);
      return undefined;
    }
    setDeviceLoading(true);
    fetchStayPlace(placeId).then((place) => {
      if (active) {
        setDeviceStay(place);
        setError('');
        setDeviceLoading(false);
      }
    }).catch(() => {
      if (active) {
        setError('Your saved stay could not be refreshed from Google Places.');
        setDeviceLoading(false);
      }
    });
    return () => { active = false; };
  }, [authLoading, destinationId, user]);

  useEffect(() => {
    if (!user || !accountStay?.placeId || accountStay.coordinates) return undefined;
    let active = true;
    fetchStayPlace(accountStay.placeId).then((place) => {
      if (active) return saveTripStay(place, {
        id: destinationId,
        name: accountStay.destination || destinationName || destinationId,
      });
      return undefined;
    }).catch(() => {
      if (active) setError('Your saved stay could not be refreshed from Google Places.');
    });
    return () => { active = false; };
  }, [accountStay, destinationId, destinationName, saveTripStay, user]);

  const saveStay = useCallback(async (place) => {
    setError('');
    try {
      if (user) {
        await saveTripStay(place, { id: destinationId, name: destinationName || place.destination || destinationId });
      } else {
        setDeviceStay(place);
        window.localStorage.setItem(localKey(destinationId), place.id);
      }
    } catch {
      setError('Your stay could not be saved. Try again.');
    }
  }, [destinationId, destinationName, saveTripStay, user]);

  const clearStay = useCallback(async () => {
    const previous = user ? accountStay : deviceStay;
    setError('');
    try {
      if (user) {
        await clearTripStay(destinationId);
      } else {
        setDeviceStay(null);
        window.localStorage.removeItem(localKey(destinationId));
      }
    } catch {
      if (!user) setDeviceStay(previous);
      setError('Your stay could not be removed. Try again.');
    }
  }, [accountStay, clearTripStay, destinationId, deviceStay, user]);

  return {
    stay: user ? accountStay : deviceStay,
    loading: authLoading || (user ? tripLoading : deviceLoading),
    error: error || (user ? tripError : ''),
    notice: user ? 'Saved to My Trip' : 'Saved on this device',
    saveStay,
    clearStay,
    persistedToAccount: Boolean(user && !tripError),
  };
}
