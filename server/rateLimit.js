export function createRateLimiter({ maxRequests = 20, windowMs = 60_000, now = Date.now } = {}) {
  const buckets = new Map();
  let requestsSinceCleanup = 0;

  const cleanup = (currentTime) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    }
  };

  return {
    check(key) {
      const currentTime = now();
      requestsSinceCleanup += 1;
      if (requestsSinceCleanup >= 100) {
        cleanup(currentTime);
        requestsSinceCleanup = 0;
      }

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        bucket = { count: 0, resetAt: currentTime + windowMs };
        buckets.set(key, bucket);
      }

      bucket.count += 1;
      return {
        allowed: bucket.count <= maxRequests,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - bucket.count),
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
      };
    },
    clear() {
      buckets.clear();
    },
  };
}
