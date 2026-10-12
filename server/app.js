import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRateLimiter } from './rateLimit.js';
import { asksForGeneralPriceGuidance, generalPriceGuidance } from './advisor.js';
import { cleanAdvisorPayload } from './validation.js';
import { cleanOfficialPricePayload } from './officialPrice.js';
import { cleanItineraryPayload } from './itinerary.js';

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
};

function sendJson(response, status, value, headers = {}) {
  response.writeHead(status, { ...securityHeaders, ...headers });
  response.end(JSON.stringify(value));
}

function readJsonBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        fail(Object.assign(new Error('Request body exceeded the configured limit.'), { status: 413, publicMessage: 'That request is too large. Shorten it and try again.' }));
        request.resume();
        return;
      }
      body += chunk;
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON request body.'), { status: 400, publicMessage: 'That request was not formatted correctly.' }));
      }
    });
    request.on('error', fail);
  });
}

function clientAddress(request, trustProxy) {
  if (trustProxy) {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim().slice(0, 80);
  }
  return request.socket.remoteAddress ?? 'local';
}

function errorResponse(error) {
  const code = error?.code ?? error?.error?.code;
  const isCreditError = code === 'credit_balance_exhausted' || error?.type === 'insufficient_quota';
  const isTimeout = error?.name === 'APIConnectionTimeoutError' || code === 'ETIMEDOUT' || code === 'ECONNABORTED';
  const isIncomplete = code === 'AI_RESPONSE_INCOMPLETE' || code === 'AI_RESPONSE_INVALID';
  const status = isCreditError
    ? 402
    : code === 'AI_NOT_CONFIGURED'
      ? 503
      : error?.status === 401
        ? 401
        : error?.status === 429
          ? 429
          : isTimeout
            ? 504
            : error?.status && error.status < 500 ? error.status : 500;
  const message = error?.publicMessage
    ?? (isCreditError
      ? 'The travel editor has no OpenAI API credits. Add credits in the OpenAI Platform, then try again.'
      : status === 401
        ? 'The OpenAI key was not accepted. Check OPENAI_API_KEY and restart WhereTo.'
        : status === 429
          ? 'The AI service is temporarily at its usage limit. Wait a moment, then try again.'
          : status === 503
            ? 'OpenAI is not configured yet. Add OPENAI_API_KEY to .env and restart WhereTo.'
            : status === 504
              ? 'The travel editor took too long to answer. Try again.'
              : isIncomplete
                ? 'The travel editor returned an incomplete answer. Try again.'
                : error?.status >= 500
                  ? 'OpenAI had a temporary problem finishing that answer. Try again.'
                  : 'The travel editor could not respond. Try again in a moment.');
  return { status, message };
}

export function createWhereToServer({ config, advisor, itinerary = null, officialPrices = null, staticFiles = null, logger = console } = {}) {
  const limiter = createRateLimiter({ maxRequests: config.rateLimitMax, windowMs: config.rateLimitWindowMs });
  const priceLimiter = createRateLimiter({ maxRequests: Math.max(10, config.rateLimitMax), windowMs: config.rateLimitWindowMs });

  return http.createServer(async (request, response) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    const url = new URL(request.url ?? '/', 'http://localhost');

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', services: { openai: advisor.configured ? 'configured' : 'missing_configuration' } });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/api/ai/status') {
      sendJson(response, 200, { configured: advisor.configured, model: advisor.model });
      return;
    }
    const isAiRequest = url.pathname === '/api/ai';
    const isItineraryRequest = url.pathname === '/api/itinerary';
    const isOfficialPriceRequest = url.pathname === '/api/official-price';
    if (!isAiRequest && !isItineraryRequest && !isOfficialPriceRequest) {
      if (!url.pathname.startsWith('/api/') && staticFiles) {
        try {
          if (await staticFiles(request, response, url)) return;
        } catch (error) {
          logger.error?.('[WhereTo static]', { requestId, status: 500, error: error?.code ?? error?.name ?? 'Error' });
          sendJson(response, 500, { error: 'The website could not be loaded.', requestId });
          return;
        }
      }
      sendJson(response, 404, { error: 'Not found', requestId });
      return;
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed', requestId }, { Allow: 'POST' });
      return;
    }

    const origin = request.headers.origin;
    if (origin && !config.allowedOrigins.has(origin)) {
      sendJson(response, 403, { error: 'This website origin is not allowed to use the travel editor.', requestId });
      return;
    }
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
      sendJson(response, 415, { error: 'Send this request as application/json.', requestId });
      return;
    }

    const rate = (isOfficialPriceRequest ? priceLimiter : limiter).check(clientAddress(request, config.trustProxy));
    response.setHeader('RateLimit-Limit', String(rate.limit));
    response.setHeader('RateLimit-Remaining', String(rate.remaining));
    if (!rate.allowed) {
      sendJson(response, 429, { error: 'The travel editor is receiving too many requests. Wait a moment and try again.', requestId }, { 'Retry-After': String(rate.retryAfterSeconds) });
      return;
    }

    if (isOfficialPriceRequest) {
      if (!officialPrices) {
        sendJson(response, 503, { error: 'Official price lookup is not available right now.', requestId });
        return;
      }
      try {
        const payload = cleanOfficialPricePayload(await readJsonBody(request, config.requestBodyLimitBytes));
        const result = await officialPrices.lookup(payload);
        logger.info?.('[WhereTo API]', { requestId, route: '/api/official-price', status: 200, result: result.status });
        sendJson(response, 200, result);
      } catch (error) {
        const status = Number(error?.status) >= 400 && Number(error?.status) < 600 ? Number(error.status) : 502;
        const message = error?.publicMessage ?? 'The official website price could not be checked right now.';
        logger.warn?.('[WhereTo API]', { requestId, route: '/api/official-price', status, error: error?.code ?? error?.name ?? 'Error' });
        sendJson(response, status, { error: message, requestId });
      }
      return;
    }

    if (isItineraryRequest) {
      if (!itinerary) {
        sendJson(response, 503, { error: 'Itinerary building is not available right now.', requestId });
        return;
      }
      try {
        const payload = cleanItineraryPayload(await readJsonBody(request, config.requestBodyLimitBytes));
        const { result, upstreamRequestId } = await itinerary.generate(payload);
        logger.info?.('[WhereTo API]', { requestId, route: '/api/itinerary', status: 200, upstreamRequestId });
        sendJson(response, 200, result);
      } catch (error) {
        const { status, message } = errorResponse(error);
        logger.error?.('[WhereTo API]', { requestId, route: '/api/itinerary', status, error: error?.code ?? error?.name ?? 'Error', upstreamRequestId: error?.upstreamRequestId ?? error?.request_id });
        sendJson(response, status, { error: message, requestId });
      }
      return;
    }

    let payload;
    try {
      payload = cleanAdvisorPayload(await readJsonBody(request, config.requestBodyLimitBytes));
      const { result, upstreamRequestId } = await advisor.respond(payload);
      logger.info?.('[WhereTo API]', { requestId, route: '/api/ai', status: 200, upstreamRequestId });
      sendJson(response, 200, result);
    } catch (error) {
      const { status, message } = errorResponse(error);
      if (payload && asksForGeneralPriceGuidance(payload) && status !== 401 && status !== 402 && status !== 503) {
        logger.warn?.('[WhereTo API]', { requestId, route: '/api/ai', status: 200, fallback: 'price-guidance', error: error?.code ?? error?.name });
        sendJson(response, 200, generalPriceGuidance(payload));
        return;
      }
      logger.error?.('[WhereTo API]', { requestId, route: '/api/ai', status, error: error?.code ?? error?.name ?? 'Error', upstreamRequestId: error?.upstreamRequestId ?? error?.request_id });
      sendJson(response, status, { error: message, requestId });
    }
  });
}
