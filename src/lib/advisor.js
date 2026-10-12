export async function getAdvisorStatus() {
  try {
    const response = await fetch('/api/ai/status', { headers: { Accept: 'application/json' } });
    if (!response.ok) return { configured: false };
    return response.json();
  } catch {
    return { configured: false };
  }
}

export async function askWhereTo(payload) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 35000);

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'WhereTo could not respond. Try again.');
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('That answer took too long. Check your connection, then try again.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
