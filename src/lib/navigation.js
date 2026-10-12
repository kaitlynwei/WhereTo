export function destinationSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replaceAll('&', 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function destinationHref(value, options = {}) {
  const params = new URLSearchParams({ place: destinationSlug(value) });
  if (options.city?.trim()) params.set('city', options.city.trim());
  if (options.stay?.trim()) params.set('stay', options.stay.trim());
  return `#destination?${params.toString()}`;
}

export function readHashLocation() {
  const rawHash = window.location.hash.replace(/^#/, '');
  const [route = 'home', query = ''] = rawHash.split('?');
  return { route, params: new URLSearchParams(query) };
}
