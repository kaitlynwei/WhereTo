import { ArrowRight, Bookmark, LogOut, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { useAuth } from '../context/AuthContext';
import { useSavedPlaces } from '../context/SavedPlacesContext';
import { useSavedPlaceDetails } from '../hooks/useSavedPlaceDetails';

export function ProfilePage() {
  const { user, displayName, profileError, signOut, updateDisplayName } = useAuth();
  const { savedPlaces, savedCount, loading: savedLoading, error: savedError } = useSavedPlaces();
  const { places: detailedPlaces, loading: detailsLoading } = useSavedPlaceDetails(savedPlaces);
  const [name, setName] = useState(displayName);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(displayName), [displayName]);

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      await updateDisplayName(name);
      setStatus('Profile updated.');
    } catch {
      setStatus('Your display name could not be updated. Check Firestore setup and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSaving(true);
    try {
      await signOut();
      window.location.hash = 'home';
    } catch {
      setStatus('You could not be signed out. Try again.');
      setSaving(false);
    }
  };

  return (
    <SiteLayout active="account" savedCount={savedCount}>
      <section className="profile-page" aria-labelledby="profile-title">
        <header className="profile-header">
          <div>
            <UserRound size={23} strokeWidth={1.5} aria-hidden="true" />
            <h1 id="profile-title">Your account</h1>
            <p>Keep your details simple and the places you want to remember close by.</p>
          </div>
          <button className="profile-signout" type="button" onClick={handleSignOut} disabled={saving}>
            <LogOut size={17} aria-hidden="true" />Sign out
          </button>
        </header>

        <div className="profile-layout">
          <section className="profile-details" aria-labelledby="profile-details-title">
            <div className="profile-section-heading">
              <h2 id="profile-details-title">Profile</h2>
              <span>Private to your account</span>
            </div>
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <label>
                <span>Display name <small>Optional</small></span>
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} autoComplete="name" placeholder="What should we call you?" />
              </label>
              <label>
                <span>Email</span>
                <input value={user?.email ?? ''} readOnly aria-readonly="true" />
              </label>
              <div className="profile-form__footer">
                <p className="profile-form__status" role="status">{status || profileError}</p>
                <button className="primary-button" type="submit" disabled={saving || name.trim() === displayName}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>

          <section className="profile-saved" aria-labelledby="profile-saved-title">
            <div className="profile-section-heading">
              <h2 id="profile-saved-title">My Trip</h2>
              <span>{savedLoading || detailsLoading ? 'Loading…' : `${savedCount} saved`}</span>
            </div>
            {savedError ? <p className="profile-inline-message" role="alert">{savedError}</p> : null}
            {!savedLoading && !detailsLoading && !savedError && detailedPlaces.length === 0 ? (
              <div className="profile-saved-empty">
                <Bookmark size={22} strokeWidth={1.5} aria-hidden="true" />
                <p>Your shortlist is ready when you are.</p>
                <a className="text-link" href="#home">Find a place <ArrowRight size={15} /></a>
              </div>
            ) : null}
            {!detailsLoading && detailedPlaces.length > 0 ? (
              <>
                <div className="profile-saved-strip">
                  {detailedPlaces.slice(0, 3).map((place) => (
                    <a href={place.href ?? '#trip'} key={place.id} aria-label={`Open ${place.name}`}>
                      {place.image ? <img src={place.image} alt={place.imageAlt ?? place.name} /> : <span className="profile-saved__image-fallback" />}
                      <span>{place.name}</span>
                    </a>
                  ))}
                </div>
                <a className="text-link profile-saved__link" href="#trip">Open My Trip <ArrowRight size={15} /></a>
              </>
            ) : null}
          </section>
        </div>
      </section>
    </SiteLayout>
  );
}
