const BASE = '/api';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function fetchOverview() {
  return get('/market/overview');
}

export function fetchStock(symbol) {
  return get(`/stock/${encodeURIComponent(symbol)}`);
}

export function searchStock(query) {
  return get(`/search?q=${encodeURIComponent(query)}`);
}
