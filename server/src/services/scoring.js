// Composite multi-factor scoring engine.
// Scores every parameter 0-100 across fundamentals/technical/volume/relative strength,
// combines them into a weighted overall score, flags strongest & weakest factors and
// produces a probability-based 30-trading-day outlook using ALL parameters together.

const clamp = (x, lo = 0, hi = 100) => Math.min(Math.max(x, lo), hi);
const r2 = (x) => (x == null || Number.isNaN(x) ? null : Math.round(x * 100) / 100);

function scoreCat(cat) {
  const entries = cat.params
    .map((p) => ({
      name: p.name, group: p.group, score: p.score, weight: p.weight == null ? 1 : p.weight,
    }))
    .filter((p) => p.score != null);
  if (!entries.length) return { score: null, params: cat.params, weight: cat.weight };
  const totalW = entries.reduce((a, p) => a + p.weight, 0) || 1;
  const score =
    entries.reduce((a, p) => a + p.score * p.weight, 0) / totalW;
  return { score: Math.round(score * 10) / 10, params: cat.params, weight: cat.weight };
}

export function scoreStock(ctx) {
  const cur = ctx.cur || {};
  const trend = ctx.trend || {};
  const rel = ctx.relative || {};
  const fund = ctx.fundamentals || {};
  const price = cur.price;

  // ---------------- Technical ----------------
  const ret20 = cur.returns?.ret20;
  const ret50 = cur.returns?.ret50;
  const ret200 = cur.returns?.ret200;

  const tech = {
    weight: 0.4,
    params: [
      {
        name: '20-day return', group: 'Technical',
        score: ret20 == null ? null : clamp(50 + ret20 * 2),
        value: ret20 == null ? null : `${ret20 >= 0 ? '+' : ''}${r2(ret20)}%`,
      },
      {
        name: '50-day return', group: 'Technical',
        score: ret50 == null ? null : clamp(50 + ret50),
        value: ret50 == null ? null : `${ret50 >= 0 ? '+' : ''}${r2(ret50)}%`,
      },
      {
        name: '200-day return', group: 'Technical',
        score: ret200 == null ? null : clamp(50 + ret200 * 0.5),
        value: ret200 == null ? null : `${ret200 >= 0 ? '+' : ''}${r2(ret200)}%`,
      },
      {
        name: 'RSI (14)', group: 'Technical', score: rsiScore(cur.rsi),
        value: cur.rsi == null ? null : r2(cur.rsi),
      },
      {
        name: 'MACD', group: 'Technical', score: macdScore(cur.macd, cur.macdSignal, cur.macdHistogram),
        value: cur.macd == null ? null : r2(cur.macd),
      },
      {
        name: 'ADX (trend strength)', group: 'Technical',
        score: adxScore(cur.adx, trend.direction),
        value: cur.adx == null ? null : r2(cur.adx),
      },
      {
        name: 'Price vs 50-DMA', group: 'Technical',
        score: cur.sma50 == null ? null : clamp(50 + pctFrom(price, cur.sma50) * 5),
        value: cur.sma50 == null ? null : `${pctPct(price, cur.sma50)}`,
      },
      {
        name: 'Price vs 200-DMA', group: 'Technical',
        score: cur.sma200 == null ? null : clamp(50 + pctFrom(price, cur.sma200) * 3),
        value: cur.sma200 == null ? null : `${pctPct(price, cur.sma200)}`,
      },
      {
        name: 'Support / Resistance room', group: 'Technical',
        score: srRoomScore(price, cur.support, cur.resistance),
      },
      {
        name: 'Breakout status', group: 'Technical',
        score: breakoutScore(price, cur.support, cur.resistance, cur.volumeSpike),
      },
      {
        name: 'Trend consistency', group: 'Technical',
        score: trendConsistencyScore(cur.macd, cur.macdSignal, cur.rsi),
        value: trend.direction || 'Sideways',
      },
    ],
  };

  // ---------------- Volume ----------------
  const vol = {
    weight: 0.2,
    params: [
      {
        name: 'Relative volume', group: 'Volume',
        score: relVolScore(cur.relativeVolume),
        value: cur.relativeVolume == null ? null : `${r2(cur.relativeVolume)}x`,
      },
      {
        name: 'Volume trend', group: 'Volume',
        score: volTrendScore(cur.returns?.ret20, cur.volumeSpike),
        value: cur.volumeSpike ? 'Spike' : 'Normal',
      },
      {
        name: 'Price-volume relationship', group: 'Volume',
        score: priceVolumeScore(cur.macd, cur.macdSignal, cur.volumeSpike, trend.direction),
      },
      {
        name: 'Delivery %', group: 'Volume',
        score: fund.delivery != null ? fund.delivery.score : null,
        value: fund.delivery != null ? fund.delivery.value : null,
        note: fund.delivery != null ? undefined : 'N/A - not provided by the data feed',
      },
    ],
  };

  // ---------------- Relative strength ----------------
  const rs = {
    weight: 0.2,
    params: [
      {
        name: 'Strength vs Nifty', group: 'Relative Strength',
        score: rel.get('nifty')?.score != null ? rel.get('nifty').score : null,
        value: rel.get('nifty')?.value,
      },
      {
        name: 'Strength vs sector', group: 'Relative Strength',
        score: rel.get('sector')?.score != null ? rel.get('sector').score : null,
        value: rel.get('sector')?.value,
      },
    ],
  };

  // ---------------- Fundamentals ----------------
  const hasFund = Object.values(fund).some((v) => v != null && v.score != null);
  const fundCats = hasFund ? buildFundamentalScores(fund) : null;

  const cats = [tech, vol, rs];
  if (fundCats) cats.push(fundCats);

  const scoredCats = cats.map(scoreCat);
  const availableCats = scoredCats.filter((c) => c.score != null);
  const totalWeight = availableCats.reduce((a, c) => a + c.weight, 0) || 1;
  const overall = availableCats.length
    ? availableCats.reduce((a, c) => a + c.score * c.weight, 0) / totalWeight
    : null;

  // strongest / weakest among all available parameter scores
  const allParams = scoredCats.flatMap((c) => c.params).filter((p) => p.score != null);
  const strongest = maxBy(allParams, (p) => p.score);
  const weakest = minBy(allParams, (p) => p.score);

  const outlook = buildOutlook({
    cats: scoredCats,
    overall,
    cur,
    trend,
    rel,
    hasFund,
  });

  return {
    categories: scoredCats.map((c) => ({
      group: c.group || c.params[0]?.group,
      score: c.score,
      weight: c.weight,
      params: c.params.map((p) => ({
        name: p.name, score: p.score, value: p.value, note: p.note,
      })),
    })),
    overall: r2(overall),
    rating: rating(overall),
    strongest: strongest ? { name: strongest.name, score: strongest.score } : null,
    weakest: weakest ? { name: weakest.name, score: weakest.score } : null,
    outlook,
    assumptions: ASSUMPTIONS,
  };
}

// ---------------- individual score fns ----------------

function rsiScore(r) {
  if (r == null) return null;
  if (r > 80) return 25;
  if (r >= 70) return 35;
  if (r >= 60) return 58;
  if (r >= 40) return 68;
  if (r >= 30) return 50;
  return 45;
}

function macdScore(macd, sig, hist) {
  if (macd == null || sig == null) return null;
  if (macd > sig && macd > 0) return 78;
  if (macd > sig) return 60;
  if (macd < sig && macd > 0) return 42;
  return 25;
}

function adxScore(adx, dir) {
  if (adx == null) return null;
  const strong = adx >= 25;
  const base = clamp(adx * 2.2);
  // Alignment with trend direction determines whether strength is good or bad.
  const bullish = dir === 'Uptrend';
  const bearish = dir === 'Downtrend';
  if (strong && bullish) return base;
  if (strong && bearish) return 100 - base;
  return 50 + (bullish ? 10 : 0) - (bearish ? 10 : 0);
}

function srRoomScore(price, support, resistance) {
  if (price == null) return null;
  let upRoom = null, dnRoom = null;
  if (resistance != null && resistance > price) upRoom = ((resistance - price) / price) * 100;
  if (support != null && support < price) dnRoom = ((price - support) / price) * 100;
  // Neither level sits on the correct side of price -> room is indeterminate.
  if (upRoom == null && dnRoom == null) return null;
  const room = (upRoom == null ? dnRoom : upRoom);
  return clamp(50 + room * 3); // more upside room => higher score
}

function breakoutScore(price, support, resistance, spike) {
  if (price == null) return null;
  const confirm = spike ? 12 : 0;
  if (resistance != null && price > resistance) return clamp(68 + confirm);
  if (support != null && price < support) return 30;
  return 50;
}

function trendConsistencyScore(macd, sig, rsi) {
  let align = 0, count = 0;
  if (macd != null && sig != null) { align += macd > sig ? 1 : -1; count++; }
  if (rsi != null) { align += rsi >= 50 ? 1 : -1; count++; }
  if (count === 0) return 50;
  return clamp(50 + (align / count) * 30);
}

function relVolScore(rv) {
  if (rv == null) return null;
  if (rv >= 2) return 78;
  if (rv >= 1.5) return 68;
  if (rv >= 1) return 58;
  if (rv >= 0.6) return 45;
  return 35;
}

function volTrendScore(ret20, spike) {
  // Rising volumes on a rising stock => healthy accumulation.
  const ret = ret20 == null ? 0 : ret20;
  if (spike) return ret > 0 ? 75 : 40;
  return clamp(50 + ret * 1.5);
}

function priceVolumeScore(macd, sig, spike, dir) {
  let s = 50;
  if (macd != null && sig != null) s += (macd > sig ? 15 : -15);
  if (spike) s += dir === 'Uptrend' ? 12 : -12;
  return clamp(s);
}

function pctFrom(price, base) {
  if (price == null || base == null || base === 0) return 0;
  return ((price - base) / base) * 100;
}
function pctPct(price, base) {
  if (price == null || base == null || base === 0) return '—';
  const v = ((price - base) / base) * 100;
  return `${v >= 0 ? '+' : ''}${r2(v)}%`;
}

// ---------------- fundamentals (slots, populated when data present) ----------------

function buildFundamentalScores(fund) {
  const f = (name, val, weight) => ({
    name, group: 'Fundamentals', score: val != null ? val.score : null, weight,
    value: val?.value,
  });
  return {
    weight: 0.2,
    params: [
      f('Revenue growth', fund.revenueGrowth, 2),
      f('EPS growth', fund.epsGrowth, 2),
      f('ROE', fund.roe, 2),
      f('ROCE', fund.roce, 2),
      f('Debt-to-Equity', fund.debtToEquity, 2),
      f('Free cash flow', fund.fcf, 2),
      f('P/E vs sector', fund.peVsSector, 1),
      f('Earnings revisions', fund.earningsRevisions, 1),
      f('Earnings surprise', fund.earningsSurprise, 1),
    ],
  };
}

// ---------------- outlook ----------------

function buildOutlook({ cats, overall, cur, trend, rel, hasFund }) {
  const price = cur.price;
  const atr = cur.atr || price * 0.02;

  // Directional pull from ALL available category scores (weighted aggregate)
  const dir = overall == null ? 0 : ((overall - 50) / 50); // -1 .. +1

  // Add relative-strength tilt
  let relTilt = 0;
  const niftyScore = rel.get && rel.get('nifty')?.score;
  if (niftyScore != null) relTilt += (niftyScore - 50) / 50;
  const sectorScore = rel.get && rel.get('sector')?.score;
  if (sectorScore != null) relTilt += (sectorScore - 50) / 50;
  const rsAvg = (niftyScore != null || sectorScore != null) ? relTilt / ((niftyScore != null ? 1 : 0) + (sectorScore != null ? 1 : 0)) : 0;

  const aggDir = clamp(dir * 0.7 + rsAvg * 0.3 * (niftyScore != null ? 1 : 0), -1, 1);

  // 30 trading days (~ sqrt(30) ATRs of cumulative range)
  const range30 = atr * Math.sqrt(30);
  const drift = aggDir * range30 * 0.5; // projected 30-day drift
  const expected30 = price + drift;
  const expectedPct = price ? (drift / price) * 100 : 0;
  const high30 = price + range30;
  const low30 = price - range30;

  // Probability distribution from aggregate direction + conviction
  const strength = Math.abs(aggDir);
  const up = clamp(0.28 + aggDir * 0.42, 0.04, 0.6);
  const down = clamp(0.28 - aggDir * 0.42, 0.04, 0.6);
  const flat = clamp(1 - up - down, 0.06, 0.4);
  const norm = up + down + flat || 1;

  const conviction = strength >= 0.5 ? 'High' : strength >= 0.25 ? 'Medium' : 'Low';

  let headline;
  if (aggDir > 0.25) headline = 'The balance of indicators points to a moderately bullish near-term outlook.';
  else if (aggDir < -0.25) headline = 'The balance of indicators points to a bearish near-term outlook.';
  else headline = 'Indicators are mixed; the stock is likely to trade range-bound over the next 30 sessions.';

  const risks = buildRisks({ cur, trend, rel, hasFund, expectedPct });

  return {
    horizon: '30 trading days',
    bias: aggDir > 0.25 ? 'Bullish' : aggDir < -0.25 ? 'Bearish' : 'Neutral',
    conviction,
    expectedPrice: r2(expected30),
    expectedReturnPct: r2(expectedPct),
    projectedRange: { low: r2(Math.max(price - range30, 0)), high: r2(price + range30) },
    probability: {
      up: r2(up / norm),
      flat: r2(flat / norm),
      down: r2(down / norm),
    },
    headline,
    risks,
  };
}

function buildRisks({ cur, trend, rel, hasFund, expectedPct }) {
  const risks = [];
  if (cur.rsi != null && cur.rsi > 75) risks.push('RSI is overbought; a sharp reversal could invalidate the bullish case.');
  if (cur.rsi != null && cur.rsi < 25) risks.push('RSI is deeply oversold; momentum may be too weak to sustain a rally.');
  if (cur.adx == null) risks.push('Trend-strength (ADX) data was unavailable, so trend-following confidence is lower.');
  if (cur.adx != null && cur.adx < 20) risks.push('ADX below 20 signals a weak trend; range conditions can change direction quickly.');
  if (cur.relativeVolume != null && cur.relativeVolume < 0.6) risks.push('Unusually low relative volume means breakouts may lack institutional backing.');
  if (!rel || (!rel.get('nifty')?.score && !rel.get('sector')?.score)) risks.push('Relative-strength data was not fully available; sector/broad-market tailwinds may be underestimated.');
  if (!hasFund) risks.push('Fundamental data is unavailable; the outlook is based solely on price/volume behaviour.');
  if (expectedPct == null || Math.abs(expectedPct) < 0.5) risks.push('The projected move is small relative to historical volatility; outcomes may be skewed by one large move.');
  return risks;
}

function rating(score) {
  if (score == null) return 'N/A';
  if (score >= 70) return 'Strong Buy';
  if (score >= 60) return 'Buy';
  if (score >= 45) return 'Wait / Neutral';
  if (score >= 35) return 'Reduce';
  return 'Sell';
}

function maxBy(arr, f) { if (!arr.length) return null; return arr.reduce((a, b) => (f(b) > f(a) ? b : a)); }
function minBy(arr, f) { if (!arr.length) return null; return arr.reduce((a, b) => (f(b) < f(a) ? b : a)); }

const ASSUMPTIONS = [
  'Scores are relative to the stock\u2019s recent history and broad index; higher score = more favourable risk/reward.',
  'The 30-day probability outlook is a statistical estimate from technical/volume/relative-strength factors, not a guarantee.',
  'Historical volatility (ATR) is used to size the expected range; actual outcomes often differ.',
  'No single indicator drives the forecast: the overall score blends every available parameter.',
  'This is informational only and not investment advice.',
];
