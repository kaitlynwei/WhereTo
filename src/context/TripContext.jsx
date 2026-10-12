import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  chooseTripForDestination,
  CURRENT_TRIP_ID,
  DEFAULT_TRIP_PREFERENCES,
  mergeTripDestinations,
  newTripRecord,
  tripDestination,
  tripIdForDestination,
  tripRemovalPlan,
  tripStay,
  tripTitle,
} from '../lib/trips';
import { useAuth } from './AuthContext';

const TripContext = createContext(null);

const tripMessage = (error) => {
  if (error?.code === 'permission-denied') return 'My Trips are blocked by the current Firestore rules. Publish the updated WhereTo rules and try again.';
  if (error?.code === 'not-found' || error?.code === 'failed-precondition') return 'My Trips need Firestore to be created in Firebase Console first.';
  if (error?.code === 'unavailable') return 'My Trips are temporarily offline. Check your connection and try again.';
  return 'My Trips could not be loaded. Try again in a moment.';
};

function legacyStayRecord(snapshot) {
  const stayDoc = snapshot.docs[0];
  if (!stayDoc) return null;
  const data = stayDoc.data();
  return { placeId: data.placeId, destinationId: data.destinationId || stayDoc.id };
}

function itineraryWithoutPlace(itinerary, placeId) {
  if (!itinerary?.days) return itinerary ?? null;
  return {
    ...itinerary,
    days: itinerary.days.map((day) => ({
      ...day,
      stops: (day.stops ?? []).filter((stop) => stop.placeId !== placeId),
    })),
  };
}

function destinationFromSavedPlace(place, fallback = {}) {
  return tripDestination({
    id: place.destinationId || fallback.id,
    name: place.destination || fallback.name,
    country: place.country || fallback.country,
  });
}

async function ensureTripStructure(userId) {
  const tripRef = doc(db, 'users', userId, 'trips', CURRENT_TRIP_ID);
  const existing = await getDoc(tripRef);
  if (!existing.exists()) {
    const existingTrips = await getDocs(collection(db, 'users', userId, 'trips'));
    if (!existingTrips.empty) return;
    const [legacyPlaces, legacyStays] = await Promise.all([
      getDocs(collection(db, 'users', userId, 'savedPlaces')),
      getDocs(collection(db, 'users', userId, 'stays')),
    ]);
    const destinations = legacyPlaces.docs.map((placeDoc) => tripDestination(placeDoc.data()));
    const stay = legacyStayRecord(legacyStays);
    if (stay) destinations.push(tripDestination({
      destinationId: stay.destinationId,
      destination: stay.destinationId.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
    }));

    const batch = writeBatch(db);
    batch.set(tripRef, {
      ...newTripRecord({ destinations, stay }),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    legacyPlaces.docs.forEach((placeDoc) => {
      batch.set(doc(tripRef, 'savedPlaces', placeDoc.id), {
        ...placeDoc.data(), id: placeDoc.id, savedAt: serverTimestamp(),
      });
    });
    await batch.commit();
    return;
  }

  const currentTrip = existing.data();
  if (Number(currentTrip.migrationVersion ?? 0) >= 2) return;
  const placesSnapshot = await getDocs(collection(tripRef, 'savedPlaces'));
  const knownDestinations = new Map((currentTrip.destinations ?? []).map((destination) => [destination.id, destination]));
  const groups = new Map();

  placesSnapshot.docs.forEach((placeDoc) => {
    const place = placeDoc.data();
    const fallback = knownDestinations.get(place.destinationId) ?? currentTrip.destinations?.[0] ?? {};
    const destination = destinationFromSavedPlace(place, fallback);
    if (!destination.id || !destination.name) return;
    if (!groups.has(destination.id)) groups.set(destination.id, { destination, places: [] });
    groups.get(destination.id).places.push(placeDoc);
  });

  const stayDestinationId = currentTrip.stay?.destinationId;
  if (stayDestinationId && !groups.has(stayDestinationId)) {
    const known = knownDestinations.get(stayDestinationId);
    groups.set(stayDestinationId, {
      destination: tripDestination(known ?? {
        id: stayDestinationId,
        name: currentTrip.stay?.destination || stayDestinationId.replaceAll('-', ' '),
      }),
      places: [],
    });
  }

  const meaningfulGroups = Array.from(groups.values());
  const primary = groups.get(stayDestinationId) ?? meaningfulGroups[0] ?? null;
  const batch = writeBatch(db);

  for (const group of meaningfulGroups) {
    if (group === primary) continue;
    const nextTripId = tripIdForDestination(group.destination);
    const nextTripRef = doc(db, 'users', userId, 'trips', nextTripId);
    const nextTrip = await getDoc(nextTripRef);
    if (nextTrip.exists()) {
      const destinations = mergeTripDestinations(nextTrip.data().destinations, [group.destination]);
      batch.set(nextTripRef, { destinations, title: tripTitle(destinations), updatedAt: serverTimestamp() }, { merge: true });
    } else {
      batch.set(nextTripRef, {
        ...newTripRecord({ id: nextTripId, destinations: [group.destination], preferences: currentTrip.preferences }),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    group.places.forEach((placeDoc) => {
      batch.set(doc(nextTripRef, 'savedPlaces', placeDoc.id), {
        ...placeDoc.data(), id: placeDoc.id, savedAt: serverTimestamp(),
      });
      batch.delete(placeDoc.ref);
    });
  }

  const primaryDestinations = primary ? [primary.destination] : [];
  batch.set(tripRef, {
    destinations: primaryDestinations,
    title: tripTitle(primaryDestinations),
    itinerary: meaningfulGroups.length > 1 ? null : (currentTrip.itinerary ?? null),
    migrationVersion: 2,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
}

function sortTrips(trips) {
  return [...trips].sort((left, right) => (
    (right.updatedAt?.toMillis?.() ?? 0) - (left.updatedAt?.toMillis?.() ?? 0)
  ));
}

export function TripProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [trips, setTrips] = useState([]);
  const [activeTripId, setActiveTripId] = useState(CURRENT_TRIP_ID);
  const [savedPlaces, setSavedPlaces] = useState([]);
  const [tripsReady, setTripsReady] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);
  const [error, setError] = useState('');
  const [pendingIds, setPendingIds] = useState([]);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user || !db) {
      setTrips([]);
      setSavedPlaces([]);
      setTripsReady(true);
      setPlacesReady(true);
      setError('');
      return undefined;
    }

    let active = true;
    let unsubscribe = () => {};
    setTripsReady(false);
    setError('');
    ensureTripStructure(user.uid).then(() => {
      if (!active) return;
      unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'trips'), (snapshot) => {
        const nextTrips = sortTrips(snapshot.docs.map((tripDoc) => ({ id: tripDoc.id, ...tripDoc.data() })));
        setTrips(nextTrips);
        setActiveTripId((current) => nextTrips.some((trip) => trip.id === current) ? current : (nextTrips[0]?.id ?? CURRENT_TRIP_ID));
        setTripsReady(true);
        setError('');
      }, (snapshotError) => {
        setTripsReady(true);
        setError(tripMessage(snapshotError));
      });
    }).catch((setupError) => {
      if (!active) return;
      setTripsReady(true);
      setPlacesReady(true);
      setError(tripMessage(setupError));
    });
    return () => { active = false; unsubscribe(); };
  }, [authLoading, retryKey, user]);

  useEffect(() => {
    if (!user || !db || !tripsReady || !activeTripId) return undefined;
    const currentRef = doc(db, 'users', user.uid, 'trips', activeTripId);
    setPlacesReady(false);
    const unsubscribe = onSnapshot(collection(currentRef, 'savedPlaces'), { includeMetadataChanges: true }, (snapshot) => {
      const places = snapshot.docs.map((placeDoc) => ({ id: placeDoc.id, ...placeDoc.data() }));
      places.sort((left, right) => (right.savedAt?.toMillis?.() ?? 0) - (left.savedAt?.toMillis?.() ?? 0));
      setSavedPlaces(places);
      setPlacesReady(true);
      setError('');
    }, (snapshotError) => {
      setPlacesReady(true);
      setError(tripMessage(snapshotError));
    });
    return unsubscribe;
  }, [activeTripId, tripsReady, user]);

  const tripData = useMemo(() => trips.find((trip) => trip.id === activeTripId) ?? null, [activeTripId, trips]);
  const savedIds = useMemo(() => savedPlaces.map((place) => place.id), [savedPlaces]);
  const tripRef = useMemo(() => (
    user && db && activeTripId ? doc(db, 'users', user.uid, 'trips', activeTripId) : null
  ), [activeTripId, user]);

  const selectTrip = useCallback((tripId) => {
    if (trips.some((trip) => trip.id === tripId)) setActiveTripId(tripId);
  }, [trips]);

  const activateDestinationTrip = useCallback((destination, preferredTripId = '') => {
    const normalized = tripDestination(destination);
    const preferred = trips.find((trip) => trip.id === preferredTripId);
    const target = preferred?.destinations?.some((item) => item.id === normalized.id)
      ? preferred
      : chooseTripForDestination(trips, normalized.id, activeTripId);
    if (target) setActiveTripId(target.id);
    return target?.id ?? '';
  }, [activeTripId, trips]);

  const addDestination = useCallback(async (destination) => {
    if (!tripRef || !tripData || !destination) return;
    const nextDestination = tripDestination(destination);
    if (!nextDestination.id || !nextDestination.name) return;
    const destinations = mergeTripDestinations(tripData.destinations, [nextDestination]);
    if (JSON.stringify(destinations) === JSON.stringify(tripData.destinations ?? [])) return;
    await setDoc(tripRef, { destinations, title: tripTitle(destinations), updatedAt: serverTimestamp() }, { merge: true });
  }, [tripData, tripRef]);

  const toggleSavedPlace = useCallback(async (place) => {
    if (!user) { window.location.hash = 'auth'; return; }
    if (!place?.id || pendingIds.includes(place.id)) return;
    const wasSaved = savedIds.includes(place.id);
    const previousPlace = savedPlaces.find((item) => item.id === place.id);
    const { firestoreRecord, ...displayPlace } = place;
    const destination = tripDestination(displayPlace);
    const targetTrip = chooseTripForDestination(trips, destination.id, activeTripId);
    const targetTripId = wasSaved ? activeTripId : (targetTrip?.id ?? tripIdForDestination(destination));
    const targetTripRef = doc(db, 'users', user.uid, 'trips', targetTripId);

    setError('');
    setPendingIds((current) => [...current, place.id]);
    if (wasSaved || targetTripId === activeTripId) {
      setSavedPlaces((current) => wasSaved
        ? current.filter((item) => item.id !== place.id)
        : [{ ...displayPlace, savedAt: null }, ...current]);
    }

    try {
      const savedRef = doc(targetTripRef, 'savedPlaces', place.id);
      const batch = writeBatch(db);
      if (wasSaved) {
        batch.delete(savedRef);
        batch.set(targetTripRef, {
          itinerary: itineraryWithoutPlace(tripData?.itinerary, place.id),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } else if (targetTrip) {
        const destinations = mergeTripDestinations(targetTrip.destinations, [destination]);
        batch.set(savedRef, { ...(firestoreRecord ?? displayPlace), id: place.id, savedAt: serverTimestamp() });
        batch.set(targetTripRef, { destinations, title: tripTitle(destinations), updatedAt: serverTimestamp() }, { merge: true });
      } else {
        batch.set(targetTripRef, {
          ...newTripRecord({ id: targetTripId, destinations: [destination], preferences: tripData?.preferences }),
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        batch.set(savedRef, { ...(firestoreRecord ?? displayPlace), id: place.id, savedAt: serverTimestamp() });
      }
      await batch.commit();
      setActiveTripId(targetTripId);
    } catch (saveError) {
      if (targetTripId === activeTripId) {
        setSavedPlaces((current) => {
          if (wasSaved && previousPlace && !current.some((item) => item.id === place.id)) return [previousPlace, ...current];
          if (!wasSaved) return current.filter((item) => item.id !== place.id);
          return current;
        });
      }
      setError(tripMessage(saveError));
    } finally {
      setPendingIds((current) => current.filter((id) => id !== place.id));
    }
  }, [activeTripId, pendingIds, savedIds, savedPlaces, tripData, trips, user]);

  const saveStay = useCallback(async (place, destination) => {
    if (!user || !db) throw new Error('My Trip is still loading.');
    const normalizedDestination = tripDestination(destination);
    const targetTrip = chooseTripForDestination(trips, normalizedDestination.id, activeTripId);
    const targetTripId = targetTrip?.id ?? tripIdForDestination(normalizedDestination);
    const targetRef = doc(db, 'users', user.uid, 'trips', targetTripId);
    const stay = tripStay(place, normalizedDestination);
    if (targetTrip) {
      const destinations = mergeTripDestinations(targetTrip.destinations, [normalizedDestination]);
      await setDoc(targetRef, { stay, destinations, title: tripTitle(destinations), updatedAt: serverTimestamp() }, { merge: true });
    } else {
      await setDoc(targetRef, {
        ...newTripRecord({ id: targetTripId, destinations: [normalizedDestination], stay, preferences: tripData?.preferences }),
        createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
    }
    setActiveTripId(targetTripId);
  }, [activeTripId, tripData?.preferences, trips, user]);

  const clearStay = useCallback(async (destinationId = '') => {
    const targetTrip = chooseTripForDestination(trips, destinationId, activeTripId) ?? tripData;
    if (!targetTrip || !user) return;
    await setDoc(doc(db, 'users', user.uid, 'trips', targetTrip.id), { stay: null, updatedAt: serverTimestamp() }, { merge: true });
  }, [activeTripId, tripData, trips, user]);

  const updatePreferences = useCallback(async (preferences) => {
    if (!tripRef || !tripData) return;
    await setDoc(tripRef, { preferences: { ...DEFAULT_TRIP_PREFERENCES, ...preferences }, updatedAt: serverTimestamp() }, { merge: true });
  }, [tripData, tripRef]);

  const saveItinerary = useCallback(async (itinerary) => {
    if (!tripRef || !tripData) throw new Error('My Trip is still loading.');
    await setDoc(tripRef, { itinerary, updatedAt: serverTimestamp() }, { merge: true });
  }, [tripData, tripRef]);

  const clearItinerary = useCallback(async () => {
    if (!tripRef) return;
    await setDoc(tripRef, { itinerary: null, updatedAt: serverTimestamp() }, { merge: true });
  }, [tripRef]);

  const removeTrip = useCallback(async (tripId = activeTripId) => {
    if (!user || !db || !tripId) throw new Error('My Trip is still loading.');
    const targetRef = doc(db, 'users', user.uid, 'trips', tripId);
    const targetTrip = trips.find((item) => item.id === tripId);
    const { remainingTrips, resetToBlankTrip, nextTripId } = tripRemovalPlan(trips, tripId);

    try {
      const savedSnapshot = await getDocs(collection(targetRef, 'savedPlaces'));
      const maximumSavedPlaces = resetToBlankTrip && tripId !== CURRENT_TRIP_ID ? 498 : 499;
      if (savedSnapshot.size > maximumSavedPlaces) throw new Error('This trip has too many saved places to remove at once.');
      const batch = writeBatch(db);
      savedSnapshot.docs.forEach((placeDoc) => batch.delete(placeDoc.ref));

      if (resetToBlankTrip) {
        const blankTrip = newTripRecord();
        if (tripId === CURRENT_TRIP_ID) {
          batch.set(targetRef, {
            ...blankTrip,
            createdAt: targetTrip?.createdAt ?? serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.delete(targetRef);
          batch.set(doc(db, 'users', user.uid, 'trips', CURRENT_TRIP_ID), {
            ...blankTrip,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        batch.delete(targetRef);
      }

      await batch.commit();
      setTrips(resetToBlankTrip
        ? [{ ...newTripRecord(), createdAt: null, updatedAt: null }]
        : remainingTrips);
      setActiveTripId(nextTripId);
      if (tripId === activeTripId || resetToBlankTrip) setSavedPlaces([]);
    } catch (removalError) {
      if (removalError?.code === 'permission-denied') {
        throw new Error('Firebase blocked this removal. Publish the current Firestore rules and try again.');
      }
      if (removalError?.code === 'unavailable') {
        throw new Error('WhereTo is offline right now. Reconnect and try removing the trip again.');
      }
      throw removalError;
    }
  }, [activeTripId, trips, user]);

  const trip = useMemo(() => tripData ? { ...tripData, savedPlaces } : null, [savedPlaces, tripData]);
  const loading = authLoading || !tripsReady || !placesReady;
  const value = useMemo(() => ({
    trip,
    trips,
    activeTripId,
    savedPlaces,
    savedIds,
    savedCount: savedPlaces.length,
    loading,
    error,
    pendingIds,
    selectTrip,
    activateDestinationTrip,
    addDestination,
    toggleSavedPlace,
    saveStay,
    clearStay,
    updatePreferences,
    saveItinerary,
    clearItinerary,
    removeTrip,
    retry: () => setRetryKey((current) => current + 1),
  }), [activeTripId, activateDestinationTrip, addDestination, clearItinerary, clearStay, error, loading, pendingIds, removeTrip, saveItinerary, saveStay, savedIds, savedPlaces, selectTrip, trip, trips, toggleSavedPlace, updatePreferences]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip() {
  const context = useContext(TripContext);
  if (!context) throw new Error('useTrip must be used inside TripProvider');
  return context;
}

export function useSavedPlaces() {
  return useTrip();
}
