export function walkingTimesErrorMessage(error) {
  const detail = String(error?.message || error || '').toLowerCase();
  if (/api_key_service_blocked|routes api|permission|request_denied|blocked/.test(detail)) {
    return 'Google Routes is not allowed on this API key yet. Direct distance is shown until Routes API is added to the key restrictions.';
  }
  if (/timed out|too long|timeout/.test(detail)) {
    return 'Walking times took too long to load, so direct distance is shown instead.';
  }
  return 'Walking times are unavailable right now, so direct distance is shown instead.';
}
