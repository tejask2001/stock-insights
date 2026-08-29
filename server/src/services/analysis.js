// Technical analysis engine for a single stock's OHLCV candles.
// Computes indicators and a composite trend/trading signal.

export function analyze(candles) {
  if (!candles || candles.length < 30) {
    return { error: 'Insufficient data to analyze (need >= 30 sessions)' };
  }

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume || 0);

  const last = candles.length - 1;
  const price = closes[last];

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);

  const rsi14 = rsi(closes, 14);
  const { macdLine, signalLine, histogram } = macd(closes, 12, 26, 9);
  const adx14 = adx(candles, 14);
  const momentum14 = momentum(closes, 14);
  const roc10 = roc(closes, 10);

  const atr14 = atr(candles, 14);
  const volatility = atr14 && price ? (atr14 / price) * 100 : null;

  const { support, resistance } = supportResistance(highs, lows, closes);

  const returns = {
    ret20: pctReturn(closes, 20),
    ret50: pctReturn(closes, 50),
    ret200: pctReturn(closes, 200),
  };

  const avgVolume = average(volumes.slice(-20));
  const avgVolume30 = average(volumes.slice(-30));
  const volumeSpike =
    avgVolume > 0 && volumes[last] > avgVolume * 1.5;
  const relativeVolume =
    avgVolume30 > 0 ? volumes[last] / avgVolume30 : null;

  const current = {
    price,
    sma20: sma20[last],
    sma50: sma50[last],
    sma200: sma200[last],
    ema9: ema9[last],
    ema21: ema21[last],
    rsi: rsi14[last],
    macd: macdLine[last],
    macdSignal: signalLine[last],
    macdHistogram: histogram[last],
    adx: adx14,
    momentum: momentum14[last],
    roc: roc10[last],
    atr: atr14,
    volatility,
    support,
    resistance,
    avgVolume,
    volumeSpike,
    relativeVolume,
    returns,
  };

  const trend = trendAnalysis(candles, current);
  const signal = buildSignal(current, trend);
  const projection = projectTrend(current, trend);
  projection.summary = buildSummary(current, trend, projection);

  return {
    indicators: current,
    trend,
    signal,
    projection,
    generatedAt: new Date().toISOString(),
  };
}

// ---------- helpers ----------

function average(arr) {
  const valid = arr.filter((x) => x != null && !Number.isNaN(x));
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function sma(data, period) {
  const out = new Array(data.length).fill(null);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
    if (i >= period) sum -= data[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(data, period) {
  const out = new Array(data.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < data.length; i++) {
    if (prev == null) {
      prev = data[i];
    } else {
      prev = data[i] * k + prev * (1 - k);
    }
    out[i] = prev;
  }
  return out;
}

function rsi(data, period = 14) {
  const out = new Array(data.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < data.length; i++) {
    const diff = data[i] - data[i - 1];
    const gain = Math.max(diff, 0);
    const loss = Math.max(-diff, 0);
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        out[i] = rsToRsi(avgGain, avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = rsToRsi(avgGain, avgLoss);
    }
  }
  return out;
}

function rsToRsi(avgGain, avgLoss) {
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(data, fast = 12, slow = 26, signalP = 9) {
  const emaFast = ema(data, fast);
  const emaSlow = ema(data, slow);
  const macdLine = data.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );
  // signal = EMA of macdLine (only over the non-null region)
  const startIdx = macdLine.findIndex((v) => v != null);
  const valid = macdLine.slice(startIdx);
  const sigValid = ema(valid, signalP);
  const signalLine = new Array(data.length).fill(null);
  for (let i = 0; i < sigValid.length; i++) signalLine[startIdx + i] = sigValid[i];
  const histogram = macdLine.map((v, i) =>
    v != null && signalLine[i] != null ? v - signalLine[i] : null
  );
  return { macdLine, signalLine, histogram };
}

function momentum(data, period = 14) {
  const out = new Array(data.length).fill(null);
  for (let i = period; i < data.length; i++) {
    out[i] = data[i] - data[i - period];
  }
  return out;
}

function roc(data, period = 10) {
  const out = new Array(data.length).fill(null);
  for (let i = period; i < data.length; i++) {
    const base = data[i - period];
    out[i] = base ? ((data[i] - base) / base) * 100 : null;
  }
  return out;
}

function pctReturn(data, period) {
  if (data.length <= period) return null;
  const base = data[data.length - 1 - period];
  if (base) return ((data[data.length - 1] - base) / base) * 100;
  return null;
}

// Wilder-smoothed Average Directional Index (ADX) over `period` bars.
function adx(candles, period = 14) {
  const n = candles.length;
  if (n < period * 2) return null;
  const tr = new Array(n).fill(0);
  const plusDM = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const h = candles[i].high, l = candles[i].low;
    const pc = candles[i - 1].close, ph = candles[i - 1].high, pl = candles[i - 1].low;
    tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - ph;
    const dn = pl - l;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
  }

  // Wilder's RMA (start with a simple average, then smooth).
  const rma = (arr, start) => {
    const out = new Array(n).fill(null);
    let v = 0;
    for (let i = start; i < period + start; i++) v += arr[i];
    v /= period;
    out[period + start - 1] = v;
    for (let i = period + start; i < n; i++) {
      v = (v * (period - 1) + arr[i]) / period;
      out[i] = v;
    }
    return out;
  };

  const trS = rma(tr, 1);
  const pS = rma(plusDM, 1);
  const mS = rma(minusDM, 1);

  // Build DX series
  const dx = new Array(n).fill(null);
  for (let i = period; i < n; i++) {
    const denom = trS[i];
    if (!denom) continue;
    const pDI = (pS[i] / denom) * 100;
    const mDI = (mS[i] / denom) * 100;
    const s = pDI + mDI;
    if (s === 0) continue;
    dx[i] = (Math.abs(pDI - mDI) / s) * 100;
  }

  // ADX = RMA of DX, starting from the first non-null DX.
  let start = period;
  while (start < n && dx[start] == null) start++;
  if (start + period >= n) {
    // fall back to simple average if too few points
    const vals = dx.filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  let adxVal = 0;
  for (let i = start; i < start + period; i++) adxVal += dx[i];
  adxVal /= period;
  for (let i = start + period; i < n; i++) adxVal = (adxVal * (period - 1) + dx[i]) / period;
  return adxVal;
}

function atr(candles, period = 14) {
  const tr = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (i === 0) {
      tr.push(c.high - c.low);
    } else {
      const prevC = candles[i - 1].close;
      tr.push(Math.max(c.high - c.low, Math.abs(c.high - prevC), Math.abs(c.low - prevC)));
    }
  }
  // Wilder smoothing
  let atrVal = average(tr.slice(0, period));
  const out = new Array(candles.length).fill(null);
  for (let i = 0; i < candles.length; i++) {
    if (i < period) continue;
    atrVal = (atrVal * (period - 1) + tr[i]) / period;
    out[i] = atrVal;
  }
  return out[out.length - 1];
}

function supportResistance(highs, lows, closes) {
  const recentHighs = highs.slice(-60).filter((x) => x != null);
  const recentLows = lows.slice(-60).filter((x) => x != null);
  const price = closes[closes.length - 1];
  const support = recentLows.length
    ? Math.max(...recentLows.slice(-10)) // nearest recent low
    : null;
  const resistance = recentHighs.length
    ? Math.min(...recentHighs.slice(-10)) // nearest recent high
    : null;
  return { support: round2(support), resistance: round2(resistance) };
}

// ---------- trend & signal ----------

function trendAnalysis(candles, cur) {
  let longTerm = 'Neutral';
  let shortTerm = 'Neutral';
  let momentumScore = 'Neutral';

  // long term: price vs SMA50 / EMA trend slope
  const p50 = cur.sma50 != null ? (cur.price - cur.sma50) / cur.sma50 : 0;
  if (cur.sma50 != null) {
    longTerm = p50 > 0.02 ? 'Bullish' : p50 < -0.02 ? 'Bearish' : 'Neutral';
  }

  // short term: price vs SMA20 & EMAs
  const p20 = cur.sma20 != null ? (cur.price - cur.sma20) / cur.sma20 : 0;
  if (cur.sma20 != null) {
    shortTerm = p20 > 0.01 ? 'Bullish' : p20 < -0.01 ? 'Bearish' : 'Neutral';
  }

  // momentum: RSI + MACD
  const r = cur.rsi;
  let rsiScore = 'Neutral';
  if (r != null) {
    if (r >= 70) rsiScore = 'Overbought';
    else if (r <= 30) rsiScore = 'Oversold';
    else if (r >= 55) rsiScore = 'Bullish';
    else if (r <= 45) rsiScore = 'Bearish';
  }

  let macdScore = 'Neutral';
  if (cur.macd != null && cur.macdSignal != null) {
    macdScore = cur.macd > cur.macdSignal ? 'Bullish' : 'Bearish';
  }

  const bullCount = [longTerm, shortTerm, rsiScore, macdScore].filter(
    (s) => s === 'Bullish' || s === 'Overbought'
  ).length;
  const bearCount = [longTerm, shortTerm, rsiScore, macdScore].filter(
    (s) => s === 'Bearish' || s === 'Oversold'
  ).length;
  if (bullCount >= 3) momentumScore = 'Bullish';
  else if (bearCount >= 3) momentumScore = 'Bearish';

  // overall trend direction based on EMA9 vs EMA21 slope
  const n = candles.length;
  const slope9 = candles[n - 1].close - emaLast(candles, 9, n - 5);
  let direction = 'Sideways';
  if (slope9 > 0 && cur.roc > 0) direction = 'Uptrend';
  else if (slope9 < 0 && cur.roc < 0) direction = 'Downtrend';

  return {
    longTerm,
    shortTerm,
    momentum: momentumScore,
    direction,
    rsiStatus: rsiScore,
    macdStatus: macdScore,
  };
}

function emaLast(candles, period, idx) {
  // cheap EMA of last few closes
  const closes = candles.map((c) => c.close);
  const slice = closes.slice(Math.max(0, idx - period * 3), idx + 1);
  const k = 2 / (period + 1);
  let prev = slice[0];
  for (let i = 1; i < slice.length; i++) prev = slice[i] * k + prev * (1 - k);
  return prev;
}

function buildSignal(cur, trend) {
  let score = 0;
  const reasons = [];

  // Trend alignment
  if (trend.longTerm === 'Bullish') { score += 2; reasons.push('Price above 50-day SMA'); }
  if (trend.longTerm === 'Bearish') { score -= 2; reasons.push('Price below 50-day SMA'); }
  if (trend.shortTerm === 'Bullish') { score += 1; reasons.push('Price above 20-day SMA'); }
  if (trend.shortTerm === 'Bearish') { score -= 1; reasons.push('Price below 20-day SMA'); }

  // Momentum
  if (cur.macd != null && cur.macdSignal != null) {
    if (cur.macd > cur.macdSignal) { score += 1; reasons.push('MACD above signal (bullish)'); }
    else { score -= 1; reasons.push('MACD below signal (bearish)'); }
    if (cur.macd > 0) score += 1;
    else score -= 1;
  }

  if (cur.rsi != null) {
    if (cur.rsi < 30) {
      score += 1;
      reasons.push(`RSI oversold (${cur.rsi.toFixed(0)}) - potential bounce`);
    } else if (cur.rsi > 70) {
      score -= 2;
      reasons.push(`RSI overbought (${cur.rsi.toFixed(0)}) - risk of pullback`);
    } else if (cur.rsi > 55) {
      score += 1;
      reasons.push(`Healthy RSI momentum (${cur.rsi.toFixed(0)})`);
    } else if (cur.rsi < 45) {
      score -= 1;
      reasons.push(`Weak RSI momentum (${cur.rsi.toFixed(0)})`);
    }
  }

  if (cur.roc > 0) { score += 1; reasons.push(`Positive momentum (${cur.roc.toFixed(1)}%)`); }
  else { score -= 1; reasons.push(`Negative momentum (${cur.roc.toFixed(1)}%)`); }

  // Volume
  if (cur.volumeSpike) {
    score += trend.direction === 'Uptrend' ? 1 : -1;
    reasons.push('Volume spike confirms ' + (trend.direction === 'Uptrend' ? 'buying' : 'selling'));
  }

  let action;
  if (score >= 3) action = 'BUY';
  else if (score >= 1) action = 'HOLD';
  else if (score <= -3) action = 'SELL';
  else action = 'HOLD';

  const strength = Math.min(Math.abs(score) / 6, 1);

  return {
    action,
    score,
    strength: round2(strength),
    confidence:
      strength >= 0.5 ? 'High' : strength >= 0.25 ? 'Medium' : 'Low',
    reasons,
  };
}

function projectTrend(cur, trend) {
  const price = cur.price;
  if (price == null || price <= 0) {
    return {
      bias: 'Neutral',
      shortTermTarget: null,
      shortTermFloor: null,
      horizon: '1-2 weeks',
    };
  }

  // Daily range proxy: ATR (or a fallback of ~2%).
  const atr = cur.atr && cur.atr > 0 ? cur.atr : price * 0.02;

  // Expected cumulative move over ~2 weeks of sessions: ATR * sqrt(N).
  const horizon = 10;
  const rangeVol = atr * Math.sqrt(horizon);

  let bias = 'Neutral';
  if (trend.direction === 'Uptrend' && trend.momentum !== 'Bearish') bias = 'Upward';
  else if (trend.direction === 'Downtrend' && trend.momentum !== 'Bullish') bias = 'Downward';

  // Anchor to real levels when they are on the correct side of the price.
  const resist = cur.resistance != null && cur.resistance > price ? cur.resistance : null;
  const supp = cur.support != null && cur.support < price ? cur.support : null;

  // Upward level: use handy resistance when present, otherwise volatility envelope.
  let upLevel = resist ?? price + rangeVol * (bias === 'Upward' ? 1.1 : 0.7);
  // Downward level: use support when present, otherwise volatility envelope.
  let downLevel = supp ?? price - rangeVol * (bias === 'Downward' ? 1.1 : 0.7);

  // Guarantee sane ordering: target always above price, floor always below.
  if (upLevel <= price) upLevel = price * 1.02;
  if (downLevel >= price) downLevel = price * 0.98;
  if (downLevel >= upLevel) {
    downLevel = price * 0.96;
    upLevel = price * 1.04;
  }

  // Expected drift depends on the bias (direction + momentum confluence).
  const drift = bias === 'Upward' ? rangeVol * 0.35 : bias === 'Downward' ? -rangeVol * 0.35 : 0;
  const expected = clamp(price + drift, downLevel, upLevel);

  return {
    bias,
    shortTermTarget: round2(upLevel),
    shortTermFloor: round2(downLevel),
    expectedPrice: round2(expected),
    expectedReturn: round2(((expected - price) / price) * 100),
    upReturnPct: round2(((upLevel - price) / price) * 100),
    downReturnPct: round2(((downLevel - price) / price) * 100),
    projectedLow: round2(downLevel),
    projectedHigh: round2(upLevel),
    horizon: '1-2 weeks',
  };
}

function buildSummary(cur, trend, proj) {
  const price = cur.price;
  if (price == null) return 'Insufficient data to summarise.';

  const parts = [];
  parts.push(`Trading near ₹${price.toFixed(0)}.`);

  // Trend alignment
  if (trend.direction === 'Uptrend') parts.push('Price is in an uptrend, above its key moving averages.');
  else if (trend.direction === 'Downtrend') parts.push('Price is in a downtrend, below its key moving averages.');
  else parts.push('Price is moving sideways with no clear directional trend.');

  // Momentum confluence (RSI + MACD)
  const r = cur.rsi;
  if (r != null) {
    let rsiPhrase;
    if (r >= 70) rsiPhrase = `RSI at ${r.toFixed(0)} signals it is overbought, raising pullback risk`;
    else if (r <= 30) rsiPhrase = `RSI at ${r.toFixed(0)} is oversold, which often precedes a bounce`;
    else if (r >= 55) rsiPhrase = `healthy RSI momentum at ${r.toFixed(0)} supports further upside`;
    else if (r <= 45) rsiPhrase = `soft RSI momentum at ${r.toFixed(0)} suggests limited upside`;
    else rsiPhrase = `RSI is neutral at ${r.toFixed(0)}`;
    parts.push(rsiPhrase + '.');
  }

  if (cur.macd != null && cur.macdSignal != null) {
    parts.push(cur.macd > cur.macdSignal ? 'MACD is above its signal line, confirming bullish momentum.' : 'MACD is below its signal line, confirming bearish momentum.');
  }

  // Support / Resistance (only cite levels on the correct side of price)
  if (cur.support != null && cur.support < price) parts.push(`Immediate support sits near ₹${cur.support.toFixed(0)}.`);
  if (cur.resistance != null && cur.resistance > price) parts.push(`Immediate resistance sits near ₹${cur.resistance.toFixed(0)}.`);

  const rangeLow = proj.projectedLow ?? price;
  const rangeHigh = proj.projectedHigh ?? price;
  parts.push(`Over the next 1-2 weeks the stock is most likely to trade within a ₹${rangeLow.toFixed(0)}-${rangeHigh.toFixed(0)} range, with a bias to the ${trend.direction === 'Downtrend' ? 'downside' : 'upside'}.`);

  return parts.join(' ');
}

function clamp(x, lo, hi) { return Math.min(Math.max(x, lo), hi); }

function round2(x) {
  if (x == null || Number.isNaN(x)) return null;
  return Math.round(x * 100) / 100;
}
