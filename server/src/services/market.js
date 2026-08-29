import { fetchDaily } from './yahoo.js';
import { analyze } from './analysis.js';
import { scoreStock } from './scoring.js';
import { computeRelativeStrength } from './rs.js';
import { fetchFundamentals } from './fundamentals.js';
import { saveStock, loadStock } from '../lib/store.js';
import { WATCHLIST } from './watchlist.js';
import { config } from '../config.js';

const cache = new Map(); // symbol -> { fetchedAt, data }

function baseAnalysis(raw) {
  const analysis = analyze(raw.candles);
  return {
    ...raw,
    analysis,
  };
}

async function computeScore(data) {
  const [relative, fundamentals] = await Promise.all([
    computeRelativeStrength({ candles: data.candles, symbol: data.symbol }),
    fetchFundamentals(data.symbol).catch(() => null),
  ]);
  const relMap = new Map([
    ['nifty', relative.nifty || {}],
    ['sector', relative.sector || {}],
  ]);
  const score = scoreStock({
    cur: data.analysis.indicators,
    trend: data.analysis.trend,
    relative: relMap,
    fundamentals: fundamentals || {},
  });
  return { score, fundamentals: fundamentals || null, relative };
}

export async function getStockAnalysis(symbol, { force = false, includeScore = false } = {}) {
  const now = Date.now();
  const cached = cache.get(symbol);
  if (!force && cached && now - cached.fetchedAt < config.dataRefreshMs) {
    if (includeScore && !cached.data.score) {
      // Cached copy came from the no-score universe scan; rebuild the score
      // so the detail view can render the composite scorecard.
      const enriched = { ...cached.data, ...(await computeScore(cached.data)) };
      cache.set(symbol, { fetchedAt: cached.fetchedAt, data: enriched });
      return enriched;
    }
    return cached.data;
  }

  const raw = await fetchDaily(symbol);
  let data = baseAnalysis(raw);

  if (includeScore) {
    data = { ...data, ...(await computeScore(data)) };
  }

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
