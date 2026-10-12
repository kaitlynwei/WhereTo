import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWhereToServer } from '../server/app.js';
import { readConfig } from '../server/config.js';
import { createStaticFileHandler } from '../server/staticFiles.js';

const silentLogger = { info() {}, warn() {}, error() {} };

async function withServer(advisor, run, env = {}, officialPrices = null, itinerary = null, staticFiles = null) {
  const config = readConfig({
    WHERETO_ALLOWED_ORIGINS: 'http://localhost:5173',
    WHERETO_RATE_LIMIT_MAX: '20',
    ...env,
  });
  const server = createWhereToServer({ config, advisor, itinerary, officialPrices, staticFiles, logger: silentLogger });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('production server serves built assets and keeps unknown API routes as JSON', async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'whereto-static-'));
  try {
    await mkdir(path.join(rootDir, 'assets'));
    await writeFile(path.join(rootDir, 'index.html'), '<!doctype html><title>WhereTo</title>');
    await writeFile(path.join(rootDir, 'assets', 'index-abc123.js'), 'console.log("WhereTo");');
    const staticFiles = createStaticFileHandler({ rootDir });
    const advisor = { configured: true, model: 'test-model', respond() {} };

    await withServer(advisor, async (baseUrl) => {
      const home = await fetch(`${baseUrl}/`, { headers: { Accept: 'text/html' } });
      assert.equal(home.status, 200);
      assert.match(await home.text(), /WhereTo/);
      assert.equal(home.headers.get('cache-control'), 'no-cache');
      assert.equal(home.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');

      const asset = await fetch(`${baseUrl}/assets/index-abc123.js`);
      assert.equal(asset.status, 200);
      assert.match(asset.headers.get('content-type'), /javascript/);
      assert.match(asset.headers.get('cache-control'), /immutable/);

      const clientRoute = await fetch(`${baseUrl}/trip`, { headers: { Accept: 'text/html' } });
      assert.equal(clientRoute.status, 200);
      assert.match(await clientRoute.text(), /WhereTo/);

      const missingApi = await fetch(`${baseUrl}/api/missing`);
      assert.equal(missingApi.status, 404);
      assert.deepEqual((await missingApi.json()).error, 'Not found');
    }, {}, null, null, staticFiles);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test('health endpoint reports configuration without exposing credentials', async () => {
  await withServer({ configured: true, model: 'test-model', respond() {} }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('x-request-id'), /^[0-9a-f-]{36}$/);
    assert.deepEqual(await response.json(), { status: 'ok', services: { openai: 'configured' } });
  });
});

test('AI endpoint accepts valid input and returns the advisor result', async () => {
  const expected = { reply: 'Answer', stage: 'clarify', followUpQuestions: [], destinations: [], neighborhoods: [], placeRecommendations: [], suggestedCategory: 'For you' };
  const advisor = { configured: true, model: 'test-model', respond: async () => ({ result: expected, upstreamRequestId: 'test' }) };
  await withServer(advisor, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Help me choose' }] }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
  });
});

test('AI endpoint rejects unexpected origins and content types', async () => {
  const advisor = { configured: true, model: 'test-model', respond: async () => { throw new Error('should not run'); } };
  await withServer(advisor, async (baseUrl) => {
    const forbidden = await fetch(`${baseUrl}/api/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' }, body: '{}',
    });
    assert.equal(forbidden.status, 403);

    const unsupported = await fetch(`${baseUrl}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    assert.equal(unsupported.status, 415);
  });
});

test('AI endpoint returns Retry-After when rate limited', async () => {
  const result = { reply: 'Okay', stage: 'clarify', followUpQuestions: [], destinations: [], neighborhoods: [], placeRecommendations: [], suggestedCategory: 'For you' };
  const advisor = { configured: true, model: 'test-model', respond: async () => ({ result }) };
  await withServer(advisor, async (baseUrl) => {
    const request = () => fetch(`${baseUrl}/api/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });
    assert.equal((await request()).status, 200);
    const blocked = await request();
    assert.equal(blocked.status, 429);
    assert.equal(blocked.headers.get('retry-after'), '60');
  }, { WHERETO_RATE_LIMIT_MAX: '1' });
});

test('missing OpenAI configuration produces a recoverable message', async () => {
  const advisor = {
    configured: false,
    model: 'test-model',
    respond: async () => { throw Object.assign(new Error('missing'), { code: 'AI_NOT_CONFIGURED' }); },
  };
  await withServer(advisor, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/ai`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'Hello' }] }),
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /not configured/i);
  });
});

test('official price endpoint validates input and returns a verified lookup result', async () => {
  const advisor = { configured: true, model: 'test-model', respond() {} };
  const officialPrices = {
    lookup: async ({ websiteUrl, placeName }) => ({
      status: 'found',
      display: 'From $44',
      sourceUrl: `${websiteUrl}tickets/`,
      officialUrl: websiteUrl,
      placeName,
      checkedAt: '2026-10-11T12:00:00.000Z',
    }),
  };
  await withServer(advisor, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/official-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({ websiteUrl: 'https://example.com/', placeName: 'Example View' }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).display, 'From $44');

    const blocked = await fetch(`${baseUrl}/api/official-price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ websiteUrl: 'file:///etc/passwd', placeName: 'Nope' }),
    });
    assert.equal(blocked.status, 400);
  }, {}, officialPrices);
});

test('itinerary endpoint validates saved places and returns a grounded plan', async () => {
  const advisor = { configured: true, model: 'test-model', respond() {} };
  const itinerary = {
    generate: async (payload) => ({
      result: { version: 1, title: 'Two days in Florence', summary: 'A plan.', pace: payload.pace, dayCount: payload.dayCount, days: [], generatedAt: '2026-10-11T12:00:00.000Z' },
      upstreamRequestId: 'itinerary-request',
    }),
  };
  await withServer(advisor, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
      body: JSON.stringify({
        dayCount: 2,
        pace: 'balanced',
        destination: 'Florence',
        places: [{ id: 'one', name: 'Uffizi Gallery' }, { id: 'two', name: 'Boboli Gardens' }],
      }),
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).title, 'Two days in Florence');

    const tooSmall = await fetch(`${baseUrl}/api/itinerary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ places: [{ id: 'one', name: 'Uffizi Gallery' }] }),
    });
    assert.equal(tooSmall.status, 400);
    assert.match((await tooSmall.json()).error, /at least two/i);
  }, {}, null, itinerary);
});
