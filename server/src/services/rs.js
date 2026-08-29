import { fetchDaily } from './yahoo.js';
import { WATCHLIST } from './watchlist.js';

// Relative-strength analysis: compares a stock's N-day return against a
// benchmark (Nifty) and against its sector peers from the watchlist.
// Returns 0-100 scores and human-readable values.

const niftyCache = { fetchedAt: 0, closes: null };

function pctRet(closes, days) {
  if (!closes || closes.length < days + 1) return null;
  const base = closes[closes.length - 1 - days];
  if (!base) return null;
  return ((closes[closes.length - 1] - base) / base) * 100;
}

function scoreFrom(diff, scale) {
  // diff = stock return - benchmark return (percentage points)
  if (diff == null) return null;
  const s = 50 + (diff / scale) * 30; // e.g. +/-(scale) maps to +-30 pts
  return Math.min(Math.max(s, 0), 100);
}

async function benchCloses(symbol) {
  // Use a small in-memory cache (5 min) so repeated views don't refetch.
  const now = Date.now();
  if (niftyCache.closes && now - niftyCache.fetchedAt < 5 * 60 * 1000) {
    return niftyCache.closes;
  }
  const data = await fetchDaily(symbol);
  const closes = data.candles.map((c) => c.close);
  niftyCache.closes = closes;
  niftyCache.fetchedAt = now;
  return closes;
}

function closesOf(s) {
  return (s.candles || []).map((c) => c.close);
}

export async function computeRelativeStrength(stockData) {
  const stockCloses = closesOf(stockData);
  const result = { nifty: { score: null, value: null }, sector: { score: null, value: null } };

  try {
    const niftyCloses = await benchCloses('^NSEI');
    for (const days of [20, 50]) {
      const sR = pctRet(stockCloses, days);
      const nR = pctRet(niftyCloses, days);
      if (sR == null || nR == null) continue;
      const diff = sR - nR;
      const score = scoreFrom(diff, 8);
      result.nifty = { score, value: `+${Math.round(diff * 10) / 10}pp over ${days}d` };
      break;
    }
  } catch (e) {
    // benchmark unavailable -> leave nifty as null
  }

  try {
    // Sector peers = other watchlist stocks with same sector (exclude indices).
    const meta = WATCHLIST.find((s) => s.symbol === stockData.symbol);
    if (meta && !meta.index) {
      const peersMeta = WATCHLIST.filter(
        (s) => s.sector === meta.sector && s.symbol !== stockData.symbol && !s.index
      );
      // Average the peers' 20-day return. Fail individually so one bad peer doesn't break all.
      const peerReturns = [];
      const overallScore = { sector: null };
      for (const p of peersMeta.slice(0, 4)) {
        try {
          const pd = await fetchDaily(p.symbol);
          const pr = pctRet(closesOf(pd), 20);
          if (pr != null) peerReturns.push(pr);
        } catch (e) {
          // skip unavailable peer
        }
      }
      if (peerReturns.length) {
        const avgPeer = peerReturns.reduce((a, b) => a + b, 0) / peerReturns.length;
        const sR = pctRet(stockCloses, 20);
        if (sR != null) {
          const diff = sR - avgPeer;
          result.sector = { score: scoreFrom(diff, 6), value: `+${Math.round(diff * 10) / 10}pp vs peers` };
        }
      }
      void overallScore;
    }
  } catch (e) {
    // sector unavailable -> leave sector as null
  }

  return result;
}
