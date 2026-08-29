import { fetchDaily } from './yahoo.js';
import { analyze } from './analysis.js';
import { saveStock, loadStock } from '../lib/store.js';
import { WATCHLIST } from './watchlist.js';
import { config } from '../config.js';

const cache = new Map(); // symbol -> { fetchedAt, data }

export async function getStockAnalysis(symbol, { force = false } = {}) {
  const now = Date.now();
  const cached = cache.get(symbol);
  if (!force && cached && now - cached.fetchedAt < config.dataRefreshMs) {
    return cached.data;
  }

  const raw = await fetchDaily(symbol);
  const analysis = analyze(raw.candles);

  const data = {
    ...raw,
    analysis,
  };

  cache.set(symbol, { fetchedAt: now, data });
  try {
    await saveStock(symbol, data);
  } catch (e) {
    // non-fatal; keep serving from memory
  }
  return data;
}

export async function scanUniverse() {
  const results = [];
  const errors = [];
  const concurrency = 6;
  for (let i = 0; i < WATCHLIST.length; i += concurrency) {
    const batch = WATCHLIST.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (s) => {
        try {
          const d = await getStockAnalysis(s.symbol);
          results.push({ ...s, ...d });
        } catch (e) {
          errors.push({ symbol: s.symbol, error: e.message });
        }
      })
    );
  }
  return { results, errors, count: results.length };
}

// Top/market movers over all tracked stocks
export function rankMarket(stocks) {
  const sorted = [...stocks].sort(
    (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)
  );
  const gainers = sorted.filter((s) => !s.index).slice(0, 10);
  const losers = [...sorted].reverse().filter((s) => !s.index).slice(0, 10);
  const mostActive = [...stocks]
    .filter((s) => !s.index)
    .filter((s) => s.candles && s.candles.length)
    .sort((a, b) => {
      const va = a.candles[a.candles.length - 1]?.volume || 0;
      const vb = b.candles[b.candles.length - 1]?.volume || 0;
      return vb - va;
    })
    .slice(0, 10);
  return { gainers, losers, mostActive };
}

// Order for sorting: BUY first, then HOLD, then SELL
export function actionRank(action) {
  if (action === 'BUY') return 0;
  if (action === 'HOLD') return 1;
  return 2;
}
