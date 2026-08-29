const BASE = '/api';

function bust() {
  return `_=${Date.now()}`;
}

async function get(path, force) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(
    `${BASE}${path}${force ? `${sep}${bust()}` : ''}`
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function fetchOverview(force = false) {
  return get('/market/overview', force);
}

export function fetchStock(symbol, force = false) {
  return get(`/stock/${encodeURIComponent(symbol)}`, force);
}

export function searchStock(query) {
  return get(`/search?q=${encodeURIComponent(query)}`);
}
