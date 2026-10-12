import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { destinationPreferenceId } from '../lib/destinationDiscovery';
import { useAuth } from './AuthContext';

const PreferencesContext = createContext(null);

function preferenceMessage(error) {
  if (error?.code === 'permission-denied') return 'Preferences are blocked by the current Firestore rules. Publish the updated rules and try again.';
  if (error?.code === 'unavailable') return 'Preferences are temporarily offline. Check your connection and try again.';
  return 'Your preferences could not be updated. Try again in a moment.';
}

function preferenceRecord(destination, signal) {
  const id = destinationPreferenceId(destination);
  return {
    id,
    type: 'destination',
    signal,
    name: destination.name,
    country: destination.country ?? '',
    categories: (destination.categories ?? []).slice(0, 10),
    updatedAt: serverTimestamp(),
  };
}

export function PreferencesProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [preferences, setPreferences] = useState([]);
  const [pendingIds, setPendingIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user || !db) {
      setPreferences([]);
      setLoading(false);
      setError('');
      return undefined;
    }

    setLoading(true);
    const preferencesCollection = collection(db, 'users', user.uid, 'preferences');
    return onSnapshot(preferencesCollection, (snapshot) => {
      setPreferences(snapshot.docs.map((preferenceDoc) => ({ id: preferenceDoc.id, ...preferenceDoc.data() })));
      setLoading(false);
      setError('');
    }, (snapshotError) => {
      setLoading(false);
      setError(preferenceMessage(snapshotError));
    });
  }, [authLoading, user]);

  const preferenceById = useMemo(() => Object.fromEntries(
    preferences.map((preference) => [preference.id, preference]),
  ), [preferences]);

  const setDestinationPreference = async (destination, signal) => {
    if (!user) {
      window.location.hash = 'auth';
      return;
    }
    if (!db) return;

    const id = destinationPreferenceId(destination);
    if (pendingIds.includes(id)) return;
    const previous = preferenceById[id];
    setPendingIds((current) => [...current, id]);
    setError('');
    setPreferences((current) => {
      const withoutCurrent = current.filter((item) => item.id !== id);
      return signal === 'neutral'
        ? withoutCurrent
        : [{ ...preferenceRecord(destination, signal), updatedAt: null }, ...withoutCurrent];
    });

    try {
      const preferenceRef = doc(db, 'users', user.uid, 'preferences', id);
      if (signal === 'neutral') await deleteDoc(preferenceRef);
      else await setDoc(preferenceRef, preferenceRecord(destination, signal));
    } catch (saveError) {
      setPreferences((current) => {
        const withoutCurrent = current.filter((item) => item.id !== id);
        return previous ? [previous, ...withoutCurrent] : withoutCurrent;
      });
      setError(preferenceMessage(saveError));
    } finally {
      setPendingIds((current) => current.filter((pendingId) => pendingId !== id));
    }
  };

  const value = useMemo(() => ({
    preferences,
    preferenceById,
    pendingIds,
    loading,
    error,
    setDestinationPreference,
  }), [error, loading, pendingIds, preferenceById, preferences]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences must be used inside PreferencesProvider');
  return context;
}
