import test from 'node:test';
import assert from 'node:assert/strict';
import { createOfficialPriceService, officialPriceInternals } from '../server/officialPrice.js';

const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];
const htmlResponse = (html, init = {}) => new Response(html, {
  status: init.status ?? 200,
  headers: { 'Content-Type': 'text/html; charset=utf-8', ...(init.headers ?? {}) },
});

test('official price parser prefers a ticket starting price over processing fees', () => {
  const price = officialPriceInternals.bestPriceFromPage(`
    <main>
      <p>$3 online processing fee added to each order</p>
      <section><h2>General Admission</h2><p>Starting at $44</p><button>Buy now</button></section>
    </main>
  `);
  assert.equal(price.amount, 44);
  assert.equal(price.currency, 'USD');
  assert.equal(price.starting, true);
});

test('official price service follows a same-site tickets page and caches the result', async () => {
  let requests = 0;
  const fetchImpl = async (url) => {
    requests += 1;
    if (url.pathname === '/tickets/') {
      return htmlResponse('<h2>General Admission</h2><p>Starting at $44</p><a>Buy now</a>');
    }
    return htmlResponse('<a href="/tickets/">Tickets</a>');
  };
  const service = createOfficialPriceService({ fetchImpl, resolveHost: publicDns, now: () => Date.parse('2026-10-11T12:00:00Z') });
  const first = await service.lookup({ websiteUrl: 'https://example.com/', placeName: 'Example View' });
  const second = await service.lookup({ websiteUrl: 'https://example.com/', placeName: 'Example View' });

  assert.equal(first.status, 'found');
  assert.equal(first.display, 'From $44');
  assert.equal(first.sourceUrl, 'https://example.com/tickets/');
  assert.deepEqual(second, first);
  assert.equal(requests, 2);
});

test('official price service reads structured Offer data', async () => {
  const service = createOfficialPriceService({
    resolveHost: publicDns,
    fetchImpl: async () => htmlResponse(`
      <script type="application/ld+json">
        {"@type":"Product","offers":{"@type":"AggregateOffer","lowPrice":"25","highPrice":"40","priceCurrency":"EUR"}}
      </script>
    `),
  });
  const result = await service.lookup({ websiteUrl: 'https://museum.example/', placeName: 'Museum' });
  assert.equal(result.status, 'found');
  assert.equal(result.display, 'From €25–€40');
});

test('official price parser recognizes visual price blocks whose currency is added by CSS', () => {
  const price = officialPriceInternals.bestPriceFromPage(`
    <section class="ticket-item">
      <h2>General Admission</h2>
      <p><strong>$3</strong> online processing fee added to each order</p>
      <h2>Starting at</h2>
      <div class="ticket-item-price actual-price"><h2><span><strong>44</strong></span></h2></div>
      <div class="ticket-item-price discount-price"><h2><span><strong>39</strong></span></h2></div>
    </section>
  `);
  assert.equal(price.amount, 44);
  assert.equal(price.currency, 'USD');
  assert.equal(price.starting, true);
});

test('official price service blocks localhost and private network targets', async () => {
  const service = createOfficialPriceService({ fetchImpl: async () => { throw new Error('must not fetch'); } });
  await assert.rejects(
    service.lookup({ websiteUrl: 'http://127.0.0.1/admin', placeName: 'Internal' }),
    /cannot be checked/i,
  );
});
