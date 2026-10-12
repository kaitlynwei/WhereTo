import dns from 'node:dns/promises';
import net from 'node:net';

const MAX_URL_LENGTH = 2_048;
const MAX_HTML_BYTES = 1_500_000;
const MAX_DISCOVERED_PAGES = 2;
const TRACKING_PARAMETER = /^(utm_|hsa_|gclid$|fbclid$|msclkid$)/i;
const PRICE_LINK_PATTERN = /\b(ticket|tickets|admission|pricing|prices|buy|book|visit)\b/i;
const MONEY_PATTERN = /(?:(US\$|CA\$|A\$|NZ\$|HK\$|S\$|USD|CAD|AUD|NZD|HKD|SGD|EUR|GBP|JPY|CHF|\$|€|£|¥)\s*)?(\d{1,5}(?:[.,]\d{1,2})?)(?:\s*(USD|CAD|AUD|NZD|HKD|SGD|EUR|GBP|JPY|CHF))?/gi;

const currencyByToken = Object.freeze({
  '$': 'USD', 'US$': 'USD', USD: 'USD',
  'CA$': 'CAD', CAD: 'CAD',
  'A$': 'AUD', AUD: 'AUD',
  'NZ$': 'NZD', NZD: 'NZD',
  'HK$': 'HKD', HKD: 'HKD',
  'S$': 'SGD', SGD: 'SGD',
  '€': 'EUR', EUR: 'EUR',
  '£': 'GBP', GBP: 'GBP',
  '¥': 'JPY', JPY: 'JPY',
  CHF: 'CHF',
});

const htmlEntities = Object.freeze({
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"', ndash: '–', mdash: '—',
});

function publicError(message, status = 400) {
  return Object.assign(new Error(message), { status, publicMessage: message });
}

function normalizeOfficialUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw.length > MAX_URL_LENGTH) throw publicError('That official website address is not valid.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw publicError('That official website address is not valid.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw publicError('Only a public official website can be checked.');
  }
  if (url.port && !((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80'))) {
    throw publicError('Only a public official website can be checked.');
  }
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMETER.test(key)) url.searchParams.delete(key);
  }
  return url;
}

function isPrivateIp(address) {
  const normalized = String(address ?? '').toLowerCase();
  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || parts[0] === 0
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || parts[0] >= 224;
  }
  if (!net.isIPv6(normalized)) return true;
  if (normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  if (normalized.startsWith('::ffff:')) return isPrivateIp(normalized.slice(7));
  return false;
}

async function assertPublicHostname(url, resolveHost) {
  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw publicError('That website cannot be checked.', 403);
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw publicError('That website cannot be checked.', 403);
    return;
  }
  let addresses;
  try {
    addresses = await resolveHost(hostname, { all: true, verbatim: true });
  } catch {
    throw publicError('The official website could not be reached.', 502);
  }
  if (!addresses?.length || addresses.some(({ address }) => isPrivateIp(address))) {
    throw publicError('That website cannot be checked.', 403);
  }
}

function siteHostname(value) {
  return value.toLowerCase().replace(/^www\./, '');
}

function belongsToOfficialSite(candidate, official) {
  const candidateHost = siteHostname(candidate.hostname);
  const officialHost = siteHostname(official.hostname);
  return candidateHost === officialHost
    || candidateHost.endsWith(`.${officialHost}`)
    || officialHost.endsWith(`.${candidateHost}`);
}

function decodeHtml(value = '') {
  return String(value).replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : match;
    }
    return htmlEntities[entity.toLowerCase()] ?? match;
  });
}

function visibleText(html) {
  return decodeHtml(String(html ?? ''))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numericPrice(value) {
  const number = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) && number > 0 && number < 1_000_000 ? number : null;
}

function formatCurrency(amount, currency = 'USD') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function structuredCandidates(html) {
  const candidates = [];
  const scripts = String(html ?? '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const currency = String(value.priceCurrency ?? value.currency ?? '').toUpperCase();
    const low = numericPrice(value.lowPrice ?? value.minPrice ?? value.price);
    const high = numericPrice(value.highPrice ?? value.maxPrice);
    if (low && /^[A-Z]{3}$/.test(currency)) {
      candidates.push({ amount: low, maxAmount: high && high >= low ? high : null, currency, confidence: value.lowPrice != null ? 18 : 15, starting: Boolean(value.lowPrice != null || value.minPrice != null) });
    }
    Object.values(value).forEach(visit);
  };

  for (const match of scripts) {
    try {
      visit(JSON.parse(decodeHtml(match[1]).trim()));
    } catch {
      // Invalid third-party JSON-LD is ignored; the visible page can still provide a price.
    }
  }
  return candidates;
}

function visibleCandidates(html) {
  const text = visibleText(html);
  const candidates = [];
  for (const match of text.matchAll(MONEY_PATTERN)) {
    const token = (match[1] || match[3] || '').toUpperCase();
    if (!token) continue;
    const amount = numericPrice(match[2]);
    if (!amount) continue;
    const start = Math.max(0, (match.index ?? 0) - 180);
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 140);
    const context = text.slice(start, end).toLowerCase();
    const immediateContext = text.slice(
      Math.max(0, (match.index ?? 0) - 20),
      Math.min(text.length, (match.index ?? 0) + match[0].length + 45),
    ).toLowerCase();
    let confidence = 0;
    if (/general admission|standard admission|adult ticket|adult admission/.test(context)) confidence += 12;
    if (/starting (?:at|from)|tickets? from|admission from/.test(context)) confidence += 9;
    if (/tickets?|admission|entry|experience/.test(context)) confidence += 5;
    if (/buy now|book now|select date/.test(context)) confidence += 2;
    if (/processing fee|service fee|booking fee|add-on|deposit|gift card/.test(immediateContext)) confidence -= 30;
    if (/child|student|senior|military|resident|member|group/.test(context)) confidence -= 5;
    if (confidence < 5) continue;
    candidates.push({
      amount,
      currency: currencyByToken[token] ?? token,
      confidence,
      starting: /starting (?:at|from)|tickets? from|admission from/.test(context),
    });
  }
  return candidates;
}

function semanticMarkupCandidates(html) {
  const source = String(html ?? '');
  const currencyToken = source.match(/(?:US\$|CA\$|A\$|NZ\$|HK\$|S\$|USD|CAD|AUD|NZD|HKD|SGD|EUR|GBP|JPY|CHF|\$|€|£|¥)/i)?.[0]?.toUpperCase() || 'USD';
  const currency = currencyByToken[currencyToken] ?? currencyToken;
  const candidates = [];
  const priceBlocks = source.matchAll(/class=["']([^"']*(?:ticket-item-price|admission-price|price-amount)[^"']*)["'][^>]*>[\s\S]{0,450}?(?:<strong[^>]*>|<span[^>]*>\s*)(\d{1,5}(?:[.,]\d{1,2})?)(?:<\/strong>|<\/span>)/gi);
  for (const match of priceBlocks) {
    const amount = numericPrice(match[2]);
    if (!amount) continue;
    const index = match.index ?? 0;
    const context = visibleText(source.slice(Math.max(0, index - 1_200), Math.min(source.length, index + match[0].length + 250))).toLowerCase();
    const classes = match[1].toLowerCase();
    let confidence = 13;
    if (/general admission|standard admission|adult admission/.test(context)) confidence += 10;
    if (/starting (?:at|from)/.test(context)) confidence += 10;
    if (/actual-price|standard-price|regular-price/.test(classes)) confidence += 5;
    if (/discount|resident|member|child|student|senior|military/.test(`${classes} ${context}`)) confidence -= 7;
    candidates.push({ amount, currency, confidence, starting: /starting (?:at|from)/.test(context) });
  }
  return candidates;
}

function bestPriceFromPage(html) {
  const candidates = [...structuredCandidates(html), ...semanticMarkupCandidates(html), ...visibleCandidates(html)];
  return candidates.sort((left, right) => (right.confidence - left.confidence) || (left.amount - right.amount))[0] ?? null;
}

function discoverPriceLinks(html, pageUrl, officialUrl) {
  const links = [];
  const seen = new Set();
  const anchors = String(html ?? '').matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    let url;
    try {
      url = normalizeOfficialUrl(new URL(decodeHtml(match[1]), pageUrl).href);
    } catch {
      continue;
    }
    if (!belongsToOfficialSite(url, officialUrl) || seen.has(url.href)) continue;
    const label = visibleText(match[2]);
    const haystack = `${url.pathname} ${label}`;
    if (!PRICE_LINK_PATTERN.test(haystack)) continue;
    let score = 0;
    if (/ticket/i.test(haystack)) score += 12;
    if (/admission|pricing|prices/i.test(haystack)) score += 9;
    if (/buy|book/i.test(haystack)) score += 6;
    if (/visit/i.test(haystack)) score += 2;
    if (/login|account|gift|event|group|member|resident/i.test(haystack)) score -= 8;
    if (score <= 0) continue;
    seen.add(url.href);
    links.push({ url, score });
  }
  return links.sort((left, right) => right.score - left.score).slice(0, MAX_DISCOVERED_PAGES);
}

async function readHtmlResponse(response) {
  const type = String(response.headers.get('content-type') ?? '').toLowerCase();
  if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) throw publicError('The official website did not return a readable page.', 502);
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_HTML_BYTES) throw publicError('The official website page was too large to check safely.', 502);
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_HTML_BYTES) throw publicError('The official website page was too large to check safely.', 502);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_HTML_BYTES) {
      await reader.cancel();
      throw publicError('The official website page was too large to check safely.', 502);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

async function fetchOfficialPage(startUrl, officialUrl, { fetchImpl, resolveHost, timeoutMs }) {
  let current = normalizeOfficialUrl(startUrl.href);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!belongsToOfficialSite(current, officialUrl)) throw publicError('The official website redirected somewhere WhereTo cannot verify.', 502);
    await assertPublicHostname(current, resolveHost);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'User-Agent': 'WhereTo/0.1 official-price-checker',
        },
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw publicError('The official website took too long to respond.', 504);
      throw publicError('The official website could not be reached.', 502);
    } finally {
      clearTimeout(timeout);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      current = normalizeOfficialUrl(new URL(response.headers.get('location'), current).href);
      continue;
    }
    if (!response.ok) throw publicError('The official website did not allow a price check.', 502);
    return { html: await readHtmlResponse(response), url: current };
  }
  throw publicError('The official website redirected too many times.', 502);
}

export function cleanOfficialPricePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw publicError('That price request was not formatted correctly.');
  return {
    websiteUrl: normalizeOfficialUrl(body.websiteUrl).href,
    placeName: String(body.placeName ?? '').trim().slice(0, 160),
  };
}

export function createOfficialPriceService({
  fetchImpl = fetch,
  resolveHost = dns.lookup,
  now = Date.now,
  timeoutMs = 8_000,
  cacheTtlMs = 12 * 60 * 60 * 1_000,
  negativeCacheTtlMs = 60 * 60 * 1_000,
} = {}) {
  const cache = new Map();
  const inFlight = new Map();

  async function findPrice({ websiteUrl, placeName = '' }) {
    const officialUrl = normalizeOfficialUrl(websiteUrl);
    const firstPage = await fetchOfficialPage(officialUrl, officialUrl, { fetchImpl, resolveHost, timeoutMs });
    const pages = [firstPage];
    const links = discoverPriceLinks(firstPage.html, firstPage.url, officialUrl);
    for (const { url } of links) {
      try {
        pages.push(await fetchOfficialPage(url, officialUrl, { fetchImpl, resolveHost, timeoutMs }));
      } catch {
        // One blocked ticket page should not discard a valid price from another official page.
      }
    }

    const ranked = pages.map((page, index) => {
      const price = bestPriceFromPage(page.html);
      if (!price) return null;
      const pageBonus = index > 0 ? 4 : 0;
      return { ...price, confidence: price.confidence + pageBonus, sourceUrl: page.url.href };
    }).filter(Boolean).sort((left, right) => (right.confidence - left.confidence) || (left.amount - right.amount));

    const checkedAt = new Date(now()).toISOString();
    const best = ranked[0];
    if (!best) {
      return { status: 'not_found', placeName, officialUrl: officialUrl.href, checkedAt };
    }
    const amount = formatCurrency(best.amount, best.currency);
    const range = best.maxAmount ? `${amount}–${formatCurrency(best.maxAmount, best.currency)}` : amount;
    return {
      status: 'found',
      placeName,
      display: best.starting || !best.maxAmount ? `From ${range}` : range,
      amount: best.amount,
      maxAmount: best.maxAmount ?? null,
      currency: best.currency,
      sourceUrl: best.sourceUrl,
      officialUrl: officialUrl.href,
      checkedAt,
    };
  }

  return {
    async lookup(payload) {
      const clean = cleanOfficialPricePayload(payload);
      const key = `${clean.websiteUrl}::${clean.placeName.toLowerCase()}`;
      const cached = cache.get(key);
      if (cached && cached.expiresAt > now()) return cached.value;
      if (inFlight.has(key)) return inFlight.get(key);

      const request = findPrice(clean).then((value) => {
        cache.set(key, { value, expiresAt: now() + (value.status === 'found' ? cacheTtlMs : negativeCacheTtlMs) });
        return value;
      }).finally(() => inFlight.delete(key));
      inFlight.set(key, request);
      return request;
    },
    clear() {
      cache.clear();
      inFlight.clear();
    },
  };
}

export const officialPriceInternals = Object.freeze({
  bestPriceFromPage,
  discoverPriceLinks,
  isPrivateIp,
  semanticMarkupCandidates,
  visibleText,
});
