const integer = (value, fallback, { min, max } = {}) => {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max ?? parsed, Math.max(min ?? parsed, parsed));
};

const boolean = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

export function readConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV?.trim() || 'development';
  const developmentOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  const configuredOrigins = String(env.WHERETO_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Object.freeze({
    host: env.WHERETO_API_HOST?.trim() || (nodeEnv === 'production' ? '0.0.0.0' : '127.0.0.1'),
    port: integer(env.PORT ?? env.WHERETO_API_PORT, 8787, { min: 1, max: 65535 }),
    nodeEnv,
    openAiApiKey: env.OPENAI_API_KEY?.trim() || '',
    openAiModel: env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
    allowedOrigins: new Set(configuredOrigins.length ? configuredOrigins : developmentOrigins),
    trustProxy: boolean(env.WHERETO_TRUST_PROXY),
    requestBodyLimitBytes: integer(env.WHERETO_REQUEST_BODY_LIMIT_BYTES, 32_768, { min: 4_096, max: 131_072 }),
    rateLimitMax: integer(env.WHERETO_RATE_LIMIT_MAX, 20, { min: 1, max: 500 }),
    rateLimitWindowMs: integer(env.WHERETO_RATE_LIMIT_WINDOW_MS, 60_000, { min: 1_000, max: 3_600_000 }),
    aiTimeoutMs: integer(env.WHERETO_AI_TIMEOUT_MS, 30_000, { min: 5_000, max: 60_000 }),
    priceLookupTimeoutMs: integer(env.WHERETO_PRICE_LOOKUP_TIMEOUT_MS, 8_000, { min: 2_000, max: 20_000 }),
    priceCacheTtlMs: integer(env.WHERETO_PRICE_CACHE_TTL_MS, 43_200_000, { min: 300_000, max: 86_400_000 }),
  });
}
