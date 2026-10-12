const priceCache = new Map();

export async function fetchOfficialPrice({ websiteUrl, placeName }) {
  const key = `${websiteUrl}::${placeName}`;
  if (priceCache.has(key)) return priceCache.get(key);

  const request = fetch('/api/official-price', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ websiteUrl, placeName }),
  }).then(async (response) => {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'The official ticket price could not be checked.');
    return body;
  });

  priceCache.set(key, request);
  request.catch(() => priceCache.delete(key));
  return request;
}
