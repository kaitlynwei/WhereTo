import { destinationSlug } from './navigation.js';

export const DESTINATION_PREFERENCE_SIGNALS = ['interested', 'not-interested'];

const budgetValues = { Thoughtful: 1, Comfortable: 2, 'Go all out': 4 };

function hashNumber(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDayNumber(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

export function destinationPreferenceId(destination) {
  return destination.id || destinationSlug(destination.name);
}

function categoryWeights(preferences) {
  return preferences.reduce((weights, preference) => {
    const direction = preference.signal === 'interested' ? 1 : -0.35;
    (preference.categories ?? []).forEach((category) => {
      weights.set(category, (weights.get(category) ?? 0) + direction);
    });
    return weights;
  }, new Map());
}

function preferenceMap(preferences) {
  return new Map(preferences.map((preference) => [preference.id, preference]));
}

function budgetScore(destination, budget) {
  const requested = budgetValues[budget];
  if (!requested || !destination.price) return 0;
  const difference = Math.abs(destination.price.length - requested);
  return difference === 0 ? 8 : difference === 1 ? 3 : -3;
}

export function rankDestinations(destinations, {
  preferences = [],
  tripPreferences = {},
  date = new Date(),
} = {}) {
  const byId = preferenceMap(preferences);
  const categorySignals = categoryWeights(preferences);
  const day = todayKey(date);
  const interests = tripPreferences.interests ?? [];

  return destinations.map((destination) => {
    const id = destinationPreferenceId(destination);
    const exactPreference = byId.get(id)?.signal ?? 'neutral';
    const categoryScore = (destination.categories ?? []).reduce((score, category) => (
      score + ((categorySignals.get(category) ?? 0) * 24)
    ), 0);
    const interestScore = (destination.categories ?? []).filter((category) => interests.includes(category)).length * 17;
    const weatherScore = tripPreferences.weather && tripPreferences.weather !== 'No preference'
      && destination.weather?.includes(tripPreferences.weather) ? 8 : 0;
    const paceScore = tripPreferences.pace && destination.paces?.includes(tripPreferences.pace) ? 10 : 0;
    const groupScore = {
      iconic: 18,
      trending: 14,
      distinctive: 5,
    }[destination.discoveryGroup] ?? (destination.underTheRadar ? 5 : 10);
    const exactScore = exactPreference === 'interested' ? 160 : exactPreference === 'not-interested' ? -1000 : 0;
    const dailyScore = hashNumber(`${day}:${id}`) * 10;

    return {
      ...destination,
      discoveryScore: exactScore + categoryScore + interestScore + weatherScore + paceScore
        + budgetScore(destination, tripPreferences.budget) + groupScore + dailyScore,
      preferenceSignal: exactPreference,
    };
  }).sort((left, right) => {
    if (left.preferenceSignal === 'not-interested' && right.preferenceSignal !== 'not-interested') return 1;
    if (right.preferenceSignal === 'not-interested' && left.preferenceSignal !== 'not-interested') return -1;
    return right.discoveryScore - left.discoveryScore;
  });
}

export function discoveryDestinationDeck(destinations, {
  shuffleKey = 0,
  ...options
} = {}) {
  return rankDestinations(destinations, options).map((destination) => ({
    ...destination,
    deckScore: destination.discoveryScore
      + (hashNumber(`${shuffleKey}:${destinationPreferenceId(destination)}`) * 18),
  })).sort((left, right) => {
    if (left.preferenceSignal === 'not-interested' && right.preferenceSignal !== 'not-interested') return 1;
    if (right.preferenceSignal === 'not-interested' && left.preferenceSignal !== 'not-interested') return -1;
    return right.deckScore - left.deckScore;
  });
}

export function dailyDestinationSelection(destinations, options = {}) {
  const count = options.count ?? 3;
  const ranked = rankDestinations(destinations, options);
  const available = ranked.filter((destination) => destination.preferenceSignal !== 'not-interested');
  const pool = available.length >= count ? available : ranked;
  const iconicPool = pool.filter((destination) => destination.discoveryGroup === 'iconic');
  const trendingPool = pool.filter((destination) => destination.discoveryGroup === 'trending');
  const distinctivePool = pool.filter((destination) => (
    destination.discoveryGroup === 'distinctive' || (!destination.discoveryGroup && destination.underTheRadar)
  ));
  const dayNumber = localDayNumber(options.date);
  const selected = [];
  const add = (destination) => {
    if (destination && !selected.some((item) => destinationPreferenceId(item) === destinationPreferenceId(destination))) {
      selected.push(destination);
    }
  };

  const addRotating = (items, multiplier) => {
    if (!items.length || selected.length >= count) return;
    const offset = (dayNumber * multiplier) % items.length;
    for (let index = 0; index < items.length; index += 1) {
      const before = selected.length;
      add(items[(offset + index) % items.length]);
      if (selected.length > before) return;
    }
  };

  add(pool.find((destination) => destination.preferenceSignal === 'interested'));

  addRotating(iconicPool, 2);
  addRotating(trendingPool, 3);
  addRotating(distinctivePool, 5);

  const broadOffset = pool.length ? (dayNumber * 3) % pool.length : 0;
  for (let index = 0; selected.length < count && index < pool.length; index += 1) {
    add(pool[(broadOffset + index) % pool.length]);
  }

  return selected.slice(0, count);
}

export function balancedDestinationSelection(destinations, options = {}) {
  const count = options.count ?? 9;
  const ranked = rankDestinations(destinations, options);
  const available = ranked.filter((destination) => destination.preferenceSignal !== 'not-interested');
  const pool = available.length >= count ? available : ranked;
  const targets = {
    iconic: Math.max(1, Math.round(count * 0.45)),
    trending: Math.max(1, Math.round(count * 0.35)),
  };
  targets.distinctive = Math.max(1, count - targets.iconic - targets.trending);
  const selected = [];
  const add = (destination) => {
    if (destination && !selected.some((item) => destinationPreferenceId(item) === destinationPreferenceId(destination))) {
      selected.push(destination);
    }
  };

  ['iconic', 'trending', 'distinctive'].forEach((group) => {
    pool.filter((destination) => (
      destination.discoveryGroup === group
      || (group === 'distinctive' && !destination.discoveryGroup && destination.underTheRadar)
    )).slice(0, targets[group]).forEach(add);
  });
  pool.forEach((destination) => { if (selected.length < count) add(destination); });
  return selected.slice(0, count);
}
