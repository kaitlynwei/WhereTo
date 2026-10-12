import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { deleteApp, initializeApp } from 'firebase/app';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

const app = initializeApp({ apiKey: 'emulator-only', projectId: 'whereto-auth-test' }, 'auth-emulator-test');
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

after(async () => {
  await deleteApp(app);
});

test('a new user can sign up, sign out, and sign back in', async () => {
  const email = `traveler-${Date.now()}@example.test`;
  const password = 'where-to-test-password';

  const created = await createUserWithEmailAndPassword(auth, email, password);
  assert.equal(created.user.email, email);
  assert.equal(auth.currentUser?.uid, created.user.uid);

  await signOut(auth);
  assert.equal(auth.currentUser, null);

  const signedIn = await signInWithEmailAndPassword(auth, email, password);
  assert.equal(signedIn.user.uid, created.user.uid);
  assert.equal(auth.currentUser?.email, email);
});
