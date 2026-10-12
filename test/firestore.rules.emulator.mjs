import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'whereto-rules-test',
    firestore: { rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8') },
  });
});

beforeEach(async () => {
  await environment.clearFirestore();
});

after(async () => {
  await environment.cleanup();
});

function profile(uid, email) {
  return doc(environment.authenticatedContext(uid, { email }).firestore(), 'users', uid);
}

test('a user can create and update only their own profile', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  const bob = environment.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
  const aliceProfile = doc(alice, 'users', 'alice');

  await assertSucceeds(setDoc(aliceProfile, {
    email: 'alice@example.test',
    displayName: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }));
  await assertSucceeds(setDoc(aliceProfile, {
    email: 'alice@example.test',
    displayName: 'Alice',
    updatedAt: serverTimestamp(),
  }, { merge: true }));
  await assertFails(getDoc(doc(bob, 'users', 'alice')));
  await assertFails(setDoc(doc(bob, 'users', 'alice'), {
    email: 'alice@example.test', displayName: 'Changed', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  }));
});

test('saved places persist for their owner and are isolated from another account', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  const bob = environment.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
  const savedPath = ['users', 'alice', 'savedPlaces', 'google-place-1'];
  const savedPlace = {
    id: 'google-place-1',
    placeId: 'google-place-1',
    type: 'google-place',
    destination: 'Tokyo',
    destinationId: 'tokyo',
    href: '#destination?place=tokyo&city=Tokyo',
    savedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(alice, ...savedPath), savedPlace));
  const loaded = await assertSucceeds(getDoc(doc(alice, ...savedPath)));
  assert.equal(loaded.data().placeId, 'google-place-1');
  await assertFails(getDoc(doc(bob, ...savedPath)));
  await assertFails(setDoc(doc(bob, ...savedPath), savedPlace));
  await assertSucceeds(deleteDoc(doc(alice, ...savedPath)));
  assert.equal((await assertSucceeds(getDoc(doc(alice, ...savedPath)))).exists(), false);
});

test('saved-place fields are strictly validated', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  await assertFails(setDoc(doc(alice, 'users', 'alice', 'savedPlaces', 'google-place-1'), {
    id: 'google-place-1',
    placeId: 'google-place-1',
    type: 'google-place',
    destination: 'Tokyo',
    destinationId: 'tokyo',
    href: '#destination?place=tokyo',
    secretExtraField: true,
    savedAt: serverTimestamp(),
  }));
});

test('a destination without a cached image can still be saved', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  await assertSucceeds(setDoc(doc(alice, 'users', 'alice', 'savedPlaces', 'destination-oaxaca'), {
    id: 'destination-oaxaca',
    type: 'destination',
    name: 'Oaxaca',
    destination: 'Oaxaca',
    destinationId: 'oaxaca',
    country: 'Mexico',
    categories: ['Food', 'Culture'],
    href: '#destination?place=oaxaca',
    savedAt: serverTimestamp(),
  }));
});

test('a stay can be saved, changed, loaded, and removed only by its owner', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  const bob = environment.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
  const aliceStay = doc(alice, 'users', 'alice', 'stays', 'barcelona');
  const bobView = doc(bob, 'users', 'alice', 'stays', 'barcelona');

  await assertSucceeds(setDoc(aliceStay, { placeId: 'hotel-1', destinationId: 'barcelona', updatedAt: serverTimestamp() }));
  await assertSucceeds(setDoc(aliceStay, { placeId: 'hotel-2', destinationId: 'barcelona', updatedAt: serverTimestamp() }));
  assert.equal((await assertSucceeds(getDoc(aliceStay))).data().placeId, 'hotel-2');
  await assertFails(getDoc(bobView));
  await assertFails(deleteDoc(bobView));
  await assertSucceeds(deleteDoc(aliceStay));
});

test('destination preferences persist for their owner and remain private', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  const bob = environment.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
  const preferencePath = ['users', 'alice', 'preferences', 'oaxaca'];
  const preference = {
    id: 'oaxaca',
    type: 'destination',
    signal: 'interested',
    name: 'Oaxaca',
    country: 'Mexico',
    categories: ['Food', 'Culture'],
    updatedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(alice, ...preferencePath), preference));
  assert.equal((await assertSucceeds(getDoc(doc(alice, ...preferencePath)))).data().signal, 'interested');
  await assertFails(getDoc(doc(bob, ...preferencePath)));
  await assertFails(setDoc(doc(bob, ...preferencePath), preference));
  await assertFails(setDoc(doc(alice, 'users', 'alice', 'preferences', 'bad'), {
    ...preference,
    id: 'bad',
    signal: 'maybe',
  }));
  await assertSucceeds(deleteDoc(doc(alice, ...preferencePath)));
});

test('a trip, its stay, and its saved places persist only for their owner', async () => {
  const alice = environment.authenticatedContext('alice', { email: 'alice@example.test' }).firestore();
  const bob = environment.authenticatedContext('bob', { email: 'bob@example.test' }).firestore();
  const tripPath = ['users', 'alice', 'trips', 'current'];
  const trip = {
    id: 'current',
    title: 'My Trip',
    status: 'active',
    destinations: [{ id: 'florence', name: 'Florence', country: 'Italy' }],
    dates: { start: null, end: null },
    stay: null,
    preferences: { interests: ['Food'], budget: 'Comfortable', weather: 'Warm', pace: 'Balanced' },
    itinerary: null,
    migrationVersion: 1,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await assertSucceeds(setDoc(doc(alice, ...tripPath), trip));
  await assertFails(getDoc(doc(bob, ...tripPath)));
  await assertSucceeds(setDoc(doc(alice, ...tripPath), {
    stay: {
      placeId: 'hotel-1',
      destinationId: 'florence',
      destination: 'Florence',
      name: 'Hotel Example',
      address: '1 Via Roma',
      coordinates: { lat: 43.77, lng: 11.25 },
    },
    updatedAt: serverTimestamp(),
  }, { merge: true }));

  await assertSucceeds(setDoc(doc(alice, ...tripPath), {
    itinerary: {
      version: 1,
      title: 'Two days in Florence',
      summary: 'Saved places grouped into two easy days.',
      pace: 'balanced',
      dayCount: 2,
      days: [
        { day: 1, title: 'Historic center', note: 'Keep the first day central.', stops: [{ placeId: 'google-place-1', timeOfDay: 'Morning', reason: 'A saved highlight.' }] },
        { day: 2, title: 'Oltrarno', note: 'A slower second day.', stops: [] },
      ],
      generatedAt: '2026-10-11T12:00:00.000Z',
    },
    updatedAt: serverTimestamp(),
  }, { merge: true }));

  await assertFails(setDoc(doc(alice, ...tripPath), {
    itinerary: { version: 1, title: 'Unsafe', summary: '', pace: 'extreme', dayCount: 99, days: [], generatedAt: 'now' },
    updatedAt: serverTimestamp(),
  }, { merge: true }));

  const savedPath = [...tripPath, 'savedPlaces', 'google-place-1'];
  const savedPlace = {
    id: 'google-place-1',
    placeId: 'google-place-1',
    type: 'google-place',
    destination: 'Florence',
    destinationId: 'florence',
    href: '#destination?place=florence&city=Florence',
    savedAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(alice, ...savedPath), savedPlace));
  await assertFails(getDoc(doc(bob, ...savedPath)));
  await assertFails(setDoc(doc(bob, ...savedPath), savedPlace));
  await assertSucceeds(deleteDoc(doc(alice, ...savedPath)));
  await assertFails(deleteDoc(doc(bob, ...tripPath)));
  await assertSucceeds(deleteDoc(doc(alice, ...tripPath)));
  await assertFails(getDoc(doc(alice, ...tripPath)));
});
