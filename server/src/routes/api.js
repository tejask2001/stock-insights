import { Router } from 'express';
import { getStockAnalysis, scanUniverse, rankMarket, actionRank } from '../services/market.js';
import { WATCHLIST } from '../services/watchlist.js';

const router = Router();

// Overview: market indices + movers + recommendations
router.get('/market/overview', async (req, res) => {
  try {
    const { results } = await scanUniverse();
    const indices = results
      .filter((s) => s.index)
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        price: s.price,
        change: s.change,
        changePercent: s.changePercent,
        dayHigh: s.dayHigh,
        dayLow: s.dayLow,
      }));

    const stocks = results.filter((s) => !s.index);
    const movers = rankMarket(stocks);

    const recommendations = stocks
      .map((s) => ({
        symbol: s.symbol,
        name: s.name,
        exchange: s.exchange,
        sector: s.sector,
        price: s.price,
        changePercent: s.changePercent,
        action: s.analysis?.signal?.action || 'HOLD',
        confidence: s.analysis?.signal?.confidence || 'Low',
        reasons: s.analysis?.signal?.reasons || [],
        bias: s.analysis?.projection?.bias || 'Neutral',
        target: s.analysis?.projection?.shortTermTarget,
        floor: s.analysis?.projection?.shortTermFloor,
        rsi: s.analysis?.indicators?.rsi,
        trend: s.analysis?.trend?.direction,
        volatility: s.analysis?.indicators?.volatility,
      }))
      .sort((a, b) => actionRank(a.action) - actionRank(b.action));

    res.json({
      indices,
      movers,
      recommendations,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Single stock detail with full analysis
router.get('/stock/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const force = req.query.force === '1';
  try {
    const data = await getStockAnalysis(symbol, { force });
    res.json(data);
  } catch (e) {
    res.status(404).json({ error: `Could not load "${symbol}": ${e.message}` });
  }
});

// Watchlist symbols metadata
router.get('/watchlist', (req, res) => {
  res.json(WATCHLIST);
});

// Search any stock by symbol or company name (NSE first, then BSE).
// Returns the matched stock analysis so the frontend can jump straight to it.
router.get('/search', async (req, res) => {
  const q = (req.query.q || '').trim().toUpperCase();
  if (!q) return res.status(400).json({ error: 'Missing search query' });

  // Normalize: strip spaces/marks, drop a trailing exchange hint
  const clean = q.replace(/\.(NS|NSE|BO|BSE)$/, '').replace(/[^A-Z0-9]/g, '');
  if (!clean) return res.status(400).json({ error: 'Invalid search query' });

  // Try watchlist exact match first (by symbol or name)
  const watchHit = WATCHLIST.find(
    (s) =>
      s.symbol.replace('.NS', '').replace('.BO', '') === clean ||
      s.name.toUpperCase().replace(/[^A-Z ]/g, '') === q.replace(/[^A-Z ]/g, '').trim()
  );
  const candidates = watchHit
    ? [watchHit.symbol]
    : [`${clean}.NS`, `${clean}.BO`];

  let lastErr = null;
  for (const sym of candidates) {
    try {
      const data = await getStockAnalysis(sym, { force: req.query.force === '1' });
      const stockMeta = WATCHLIST.find((s) => s.symbol === sym) || {};
      return res.json({
        ...data,
        sector: stockMeta.sector || 'N/A',
        matchedSymbol: sym,
      });
    } catch (e) {
      lastErr = e;
    }
  }
  res.status(404).json({
    error: `No data found for "${q}". Try a ticker like TATAMOTORS or TCS.`,
    detail: lastErr?.message,
  });
});

export default router;
