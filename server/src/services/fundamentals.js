import fetch from 'node-fetch';
import { config } from '../config.js';

// Fundamentals service.
// Returns scoring-ready metrics (each an object { score, value }) or nulls
// when a parameter is not available. The scoring engine excludes nulls from
// the weighted total so the overall score stays honest.
//
// Provider is selected via FUNDAMENTALS_PROVIDER env (bharatstock | fmp).
// The BharatStock mapping below is a *known-shape* adapter: exact endpoints
// are confirmed from the provider's docs before enabling.

const cache = new Map(); // symbol -> { at: ms, data }

export function isEnabled() {
  return (
    config.fundamentals.provider === 'bharatstock'
      ? !!config.fundamentals.bharatstockKey
      : config.fundamentals.provider === 'fmp'
      ? !!config.fundamentals.fmpKey
      : false
  );
}

// 0-100 helpers for fundamental magnitudes (Indian market reference bands).
function growthScore(pct) {
  if (pct == null) return null;
  // revenue/EPS growth: >25% excellent, ~15% good, <0% negative
  const s = 50 + pct * 2;
  return Math.min(Math.max(s, 0), 100);
}
function roeScore(roe) {
  if (roe == null) return null;
  // >20% excellent, 15-20 good, <10 weak (large-cap INR norms)
  const s = 50 + (roe - 12) * 2.5;
  return Math.min(Math.max(s, 0), 100);
}
function roceScore(roce) {
  if (roce == null) return null;
  const s = 50 + (roce - 12) * 2.2;
  return Math.min(Math.max(s, 0), 100);
}
function deScore(de) {
  if (de == null) return null;
  // debt-to-equity: lower is safer; <0.5 strong, >1.5 risky
  const s = (1.5 - de) * 55;
  return Math.min(Math.max(s, 0), 100);
}
function fcfScore(fcfPerShare) {
  if (fcfPerShare == null) return null;
  // positive FCF is good; magnitude is harder to normalise so use sign + scale
  const s = 50 + Math.min(fcfPerShare, 25);
  return Math.min(Math.max(s, 0), 100);
}
function peScore(pe, sectorPe) {
  if (pe == null) return null;
  if (sectorPe == null) {
    // lower-than-market P/E is generally favourable
    return Math.min(Math.max(70 - pe, 0), 100);
  }
  const ratio = pe / sectorPe;
  return Math.min(Math.max(50 - (ratio - 1) * 40, 0), 100); // <1x => better
}
function surpriseScore(pct) {
  if (pct == null) return null;
  return Math.min(Math.max(50 + pct * 3, 0), 100);
}
function revisionScore(direction) {
  // direction: +1 up, 0 flat, -1 down
  if (direction == null) return null;
  return Math.min(Math.max(50 + direction * 40, 0), 100);
}

export async function fetchFundamentals(symbol) {
  if (!isEnabled()) {
    return unavailable();
  }

  const now = Date.now();
  const cached = cache.get(symbol);
  if (cached && now - cached.at < 24 * 60 * 60 * 1000) return cached.data;

  let raw;
  try {
    if (config.fundamentals.provider === 'bharatstock') {
      raw = await fetchBharatstock(symbol);
    } else {
      raw = await fetchFmp(symbol);
    }
  } catch (e) {
    return unavailable();
  }

  if (!raw) return unavailable();

  const data = mapToScores(raw);
  cache.set(symbol, { at: now, data });
  return data;
}

// ---- mapping ----
function mapToScores(raw) {
  return {
    revenueGrowth: { score: growthScore(raw.revenueGrowthPct), value: fmtPct(raw.revenueGrowthPct, 'rev') },
    epsGrowth: { score: growthScore(raw.epsGrowthPct), value: fmtPct(raw.epsGrowthPct, 'eps') },
    roe: { score: roeScore(raw.roe), value: raw.roe == null ? null : `${raw.roe.toFixed(1)}%` },
    roce: { score: roceScore(raw.roce), value: raw.roce == null ? null : `${raw.roce.toFixed(1)}%` },
    debtToEquity: { score: deScore(raw.debtToEquity), value: raw.debtToEquity == null ? null : `${raw.debtToEquity.toFixed(2)}` },
    fcf: { score: fcfScore(raw.fcfPerShare), value: raw.fcfPerShare == null ? null : `₹${raw.fcfPerShare.toFixed(2)}/sh` },
    peVsSector: { score: peScore(raw.peRatio, raw.sectorPeRatio), value: raw.peRatio == null ? null : `${raw.peRatio.toFixed(1)}x` },
    earningsRevisions: { score: revisionScore(raw.earningsRevisionDirection), value: raw.earningsRevisionDirection },
    earningsSurprise: { score: surpriseScore(raw.earningsSurprisePct), value: fmtPct(raw.earningsSurprisePct, 'surprise') },
    delivery: raw.deliveryPct == null
      ? null
      : { score: deliveryScore(raw.deliveryPct), value: `${raw.deliveryPct.toFixed(1)}%` },
  };
}

function deliveryScore(deliveryPct) {
  if (deliveryPct == null) return null;
  // Indian market norms: delivery above ~55% suggests strong institutional holding;
  // very low delivery (<30%) hints at speculative/froth activity.
  const s = 50 + (deliveryPct - 40) * 1.6;
  return Math.min(Math.max(s, 0), 100);
}

function fmtPct(v, kind) {
  if (v == null) return null;
  return `${kind}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

// ---- provider clients ----
async function fetchBharatstock(symbol) {
  const clean = symbol.replace('.NS', '').replace('.BO', '');
  const base = config.fundamentals.bharatstockBase;
  const key = config.fundamentals.bharatstockKey;
  const headers = { 'X-API-Key': key, 'Accept': 'application/json' };
  const opt = { headers, timeout: 20000 };

  // Single call to /v1/stocks/{ticker} exposes a rich `metrics` object plus
  // `latest_price.delivery_pct`. Confirmed from the live API (TCS/RELIANCE/INFY):
  //   metrics.revenue_growth_yoy      -> Revenue growth
  //   metrics.eps_growth_yoy          -> EPS growth
  //   metrics.debt_to_equity          -> Debt-to-Equity
  //   metrics.free_cash_flow          -> Free cash flow (total, in Rs)
  //   metrics.total_shares            -> share count (to derive FCF/share)
  //   metrics.pe_ratio / roe / roce   -> valuation & profitability
  //   latest_price.delivery_pct       -> Delivery % (often null from the feed)
  let stock = null;
  try {
    const res = await fetch(`${base}/v1/stocks/${encodeURIComponent(clean)}`, opt);
    if (res.ok) stock = await res.json();
  } catch { stock = null; }
  if (!stock) return null;

  const m = stock.metrics || {};
  const totalShares = m.total_shares;
  const fcfPerShare =
    m.free_cash_flow != null && totalShares != null && totalShares !== 0
      ? m.free_cash_flow / totalShares
      : null;

  return {
    revenueGrowthPct: m.revenue_growth_yoy ?? null,
    epsGrowthPct: m.eps_growth_yoy ?? null,
    roe: m.roe ?? null,
    roce: m.roce ?? null,
    debtToEquity: m.debt_to_equity ?? null,
    fcfPerShare,
    peRatio: m.pe_ratio ?? null,
    sectorPeRatio: null,
    earningsRevisionDirection: null, // not provided by the BharatStock API
    earningsSurprisePct: null,       // not provided by the BharatStock API
    deliveryPct: stock.latest_price?.delivery_pct ?? null, // null when unavailable
  };
}

async function fetchFmp(symbol) {
  // FMP uses the same .NS suffix for Indian tickers.
  const base = 'https://financialmodelingprep.com/api/v3';
  const key = config.fundamentals.fmpKey;
  const [km, growth, surprises] = await Promise.allSettled([
    fetch(`${base}/key-metrics-ttm/${symbol}?apikey=${key}`).then((r) => r.json()),
    fetch(`${base}/income-statement-growth/${symbol}?limit=2&apikey=${key}`).then((r) => r.json()),
    fetch(`${base}/earnings-surprises/${symbol}?apikey=${key}`).then((r) => r.json()),
  ]);
  const kmData = km.status === 'fulfilled' ? km.value?.[0] : null;
  const growthData = growth.status === 'fulfilled' && Array.isArray(growth.value) ? growth.value : [];
  const surData = surprises.status === 'fulfilled' && Array.isArray(surprises.value) ? surprises.value : [];
  if (!kmData) return null;

  const latest = growthData[0] || {};
  const latestSurprise = surData[0] || {};
  return {
    revenueGrowthPct: latest.revenueGrowth != null ? latest.revenueGrowth * 100 : null,
    epsGrowthPct: latest.epsgrowth != null ? latest.epsgrowth : null,
    roe: kmData.roe,
    roce: kmData.roic,
    debtToEquity: kmData.debtToEquity,
    fcfPerShare: kmData.freeCashFlowPerShare,
    peRatio: kmData.peRatio,
    sectorPeRatio: null,
    earningsRevisionDirection: null,
    earningsSurprisePct: latestSurprise.surprisePercent ?? null,
  };
}

function unavailable() {
  return {
    revenueGrowth: null, epsGrowth: null, roe: null, roce: null,
    debtToEquity: null, fcf: null, peVsSector: null,
    earningsRevisions: null, earningsSurprise: null, delivery: null,
  };
}
