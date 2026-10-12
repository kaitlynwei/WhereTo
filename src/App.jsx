import { useCallback, useEffect, useState } from 'react';
import { AuthPage } from './pages/AuthPage';
import { ChoosePage } from './pages/ChoosePage';
import { DestinationPage } from './pages/DestinationPage';
import { HomePage } from './pages/HomePage';
import { ProfilePage } from './pages/ProfilePage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { SavedPage } from './pages/SavedPage';
import { SearchPage } from './pages/SearchPage';
import { TravelAdvisorPage } from './pages/TravelAdvisorPage';
import { useAuth } from './context/AuthContext';
import { useSavedPlaces } from './context/SavedPlacesContext';
import { useTrip } from './context/TripContext';
import { readHashLocation } from './lib/navigation';
import { DEFAULT_TRIP_PREFERENCES } from './lib/trips';

const routes = new Set([
  'home', 'choose', 'recommendations', 'search', 'destination', 'saved', 'trip', 'auth', 'account', 'advisor',
]);

function readRoute() {
  const location = readHashLocation();
  return routes.has(location.route) ? location : { route: 'home', params: new URLSearchParams() };
}

export function App() {
  const [location, setLocation] = useState(readRoute);
  const { user } = useAuth();
  const { savedIds, savedCount, pendingIds, toggleSavedPlace } = useSavedPlaces();
  const { trip, updatePreferences } = useTrip();
  const [tripPreferences, setTripPreferenceState] = useState(DEFAULT_TRIP_PREFERENCES);

  useEffect(() => {
    if (user && trip?.preferences) {
      setTripPreferenceState({ ...DEFAULT_TRIP_PREFERENCES, ...trip.preferences });
    }
  }, [trip?.preferences, user]);

  const setTripPreferences = useCallback((value) => {
    setTripPreferenceState((current) => {
      const next = typeof value === 'function' ? value(current) : value;
      if (user) updatePreferences(next).catch(() => {});
      return next;
    });
  }, [updatePreferences, user]);

  useEffect(() => {
    const onHashChange = () => {
      setLocation(readRoute());
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const shared = { savedIds, pendingIds, toggleSaved: toggleSavedPlace };
  const { route, params } = location;

  if (route === 'choose') return <ChoosePage savedCount={savedCount} tripPreferences={tripPreferences} setTripPreferences={setTripPreferences} />;
  if (route === 'recommendations') return <RecommendationsPage savedCount={savedCount} tripPreferences={tripPreferences} />;
  if (route === 'advisor') return <TravelAdvisorPage savedCount={savedCount} tripPreferences={tripPreferences} />;
  if (route === 'search') return <SearchPage savedCount={savedCount} />;
  if (route === 'destination') return <DestinationPage {...shared} destinationSlug={params.get('place') ?? 'new-york'} cityName={params.get('city') ?? ''} stay={params.get('stay') ?? ''} tripId={params.get('trip') ?? ''} tripPreferences={tripPreferences} />;
  if (route === 'saved' || route === 'trip') return <SavedPage />;
  if (route === 'auth' || route === 'account') return user ? <ProfilePage /> : <AuthPage savedCount={savedCount} />;
  return <HomePage {...shared} tripPreferences={tripPreferences} />;
}
