import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, runTransaction, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';

const AuthContext = createContext(null);

async function ensureUserProfile(firebaseUser) {
  if (!db) return null;
  const profileRef = doc(db, 'users', firebaseUser.uid);
  return runTransaction(db, async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (profileSnapshot.exists()) return profileSnapshot.data();

    const profile = {
      email: firebaseUser.email,
      displayName: firebaseUser.displayName ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    transaction.set(profileRef, profile);
    return profile;
  });
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [initializationError, setInitializationError] = useState(null);
  const [profileError, setProfileError] = useState('');

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return undefined;
    }

    let unsubscribe = () => {};
    let active = true;

    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
          setUser(nextUser);
          setDisplayName(nextUser?.displayName ?? '');
          setProfileError('');
          setLoading(false);

          if (nextUser && db) {
            try {
              const profile = await ensureUserProfile(nextUser);
              setDisplayName(profile?.displayName ?? nextUser.displayName ?? '');
            } catch {
              setProfileError('Your account is signed in, but its profile could not be loaded from Firestore.');
            }
          }
        });
      })
      .catch((error) => {
        if (!active) return;
        setInitializationError(error);
        unsubscribe = onAuthStateChanged(auth, (nextUser) => {
          setUser(nextUser);
          setDisplayName(nextUser?.displayName ?? '');
          setLoading(false);
        });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signUp = async (email, password) => {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (db) {
      try {
        await ensureUserProfile(credential.user);
      } catch {
        setProfileError('Your account was created, but its profile could not be added to Firestore yet.');
      }
    }
    return credential;
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setProfileError('');
  };

  const saveDisplayName = async (nextDisplayName) => {
    const normalizedName = nextDisplayName.trim();
    if (!auth?.currentUser) throw new Error('You must be signed in to update your profile.');

    setProfileError('');
    await updateProfile(auth.currentUser, { displayName: normalizedName });
    if (db) {
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        email: auth.currentUser.email,
        displayName: normalizedName,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    setDisplayName(normalizedName);
  };

  const value = useMemo(() => ({
    user,
    displayName,
    loading,
    isConfigured: isFirebaseConfigured,
    initializationError,
    profileError,
    signUp,
    signIn: (email, password) => signInWithEmailAndPassword(auth, email, password),
    signOut,
    updateDisplayName: saveDisplayName,
  }), [displayName, initializationError, loading, profileError, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
