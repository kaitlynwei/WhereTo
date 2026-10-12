import { ArrowRight, LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { SiteLayout } from '../components/SiteLayout';
import { useAuth } from '../context/AuthContext';

const authMessages = {
  'auth/email-already-in-use': 'An account already exists for this email. Try signing in instead.',
  'auth/invalid-credential': 'That email and password combination was not recognized.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Choose a password with at least six characters.',
  'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.',
  'auth/network-request-failed': 'The network request failed. Check your connection and try again.',
};

const friendlyMessage = (error) => authMessages[error?.code] ?? 'Something went wrong. Please try again.';

export function AuthPage({ savedCount }) {
  const { user, loading: authLoading, isConfigured, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!isConfigured) {
      setMessage('Firebase is not configured yet. Add the project values to your .env file first.');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setMessage('The passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') await signUp(email.trim(), password);
      else await signIn(email.trim(), password);
      window.location.hash = 'home';
    } catch (error) {
      setMessage(friendlyMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    setSubmitting(true);
    setMessage('');
    try {
      await signOut();
      window.location.hash = 'home';
    } catch (error) {
      setMessage(friendlyMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <SiteLayout active="account" savedCount={savedCount}>
      <section className="auth-page" aria-labelledby="auth-title">
        {authLoading ? (
          <div className="auth-loading" role="status">Checking your account…</div>
        ) : user ? (
          <div className="account-panel">
            <UserRound size={24} strokeWidth={1.5} aria-hidden="true" />
            <h1 id="auth-title">Your account</h1>
            <p>You’re signed in as <strong>{user.email}</strong>.</p>
            <button className="primary-button" type="button" onClick={handleSignOut} disabled={submitting}>
              <LogOut size={17} aria-hidden="true" />{submitting ? 'Signing out…' : 'Sign out'}
            </button>
            {message ? <p className="auth-message" role="alert">{message}</p> : null}
          </div>
        ) : (
          <div className="auth-layout">
            <div className="auth-intro">
              <h1 id="auth-title">{mode === 'signin' ? 'Welcome back' : 'Make WhereTo yours'}</h1>
              <p>{mode === 'signin' ? 'Sign in and pick up where you left off.' : 'Create an account with your email and a password.'}</p>
            </div>
            <div className="auth-form-wrap">
              <div className="auth-mode" role="tablist" aria-label="Account action">
                <button type="button" role="tab" aria-selected={mode === 'signin'} className={mode === 'signin' ? 'is-active' : ''} onClick={() => { setMode('signin'); setMessage(''); }}>Sign in</button>
                <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'is-active' : ''} onClick={() => { setMode('signup'); setMessage(''); }}>Sign up</button>
              </div>
              <form className="auth-form" onSubmit={handleSubmit}>
                <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                {mode === 'signup' ? <label>Confirm password<input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label> : null}
                {!isConfigured ? <p className="auth-setup-note">Firebase setup is waiting for your project configuration.</p> : null}
                {message ? <p className="auth-message" role="alert">{message}</p> : null}
                <button className="primary-button auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={17} aria-hidden="true" />
                </button>
              </form>
            </div>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
