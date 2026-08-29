import fetch from 'node-fetch';

// Yahoo Finance chart API works for Indian stocks:
//   NSE symbols end with ".NS", BSE symbols end with ".BO"
// e.g. RELIANCE.NS, TCS.BO, INFY.NS
// No API key required for the chart endpoint.

const RANGE = '6mo';
const INTERVAL = '1d';

export async function fetchDaily(symbol, range = RANGE, interval = INTERVAL) {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) +
    `?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplit`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
    timeout: 20000,
  });

  if (!res.ok) {
    throw new Error(`Yahoo fetch failed for ${symbol}: HTTP ${res.status}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No data returned for ${symbol}`);

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const meta = result.meta || {};

  // Resolve current price from meta (post market adjusted) else last close
  const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
  const change =
    meta.regularMarketPrice != null && meta.chartPreviousClose != null
      ? meta.regularMarketPrice - meta.chartPreviousClose
      : 0;
  const changePercent =
    meta.chartPreviousClose ? (change / meta.chartPreviousClose) * 100 : 0;

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = quote.close?.[i];
    const v = quote.volume?.[i];
    // skip null closes so indicator math is clean
    if (c == null) continue;
    candles.push({
      date: new Date(timestamps[i] * 1000).toISOString(),
      open: round(o),
      high: round(h),
      low: round(l),
      close: round(c),
      volume: v ?? 0,
    });
  }

  return {
    symbol,
    companyName: meta.longName || meta.shortName || symbol,
    exchange: meta.exchangeName || (symbol.endsWith('.NS') ? 'NSE' : 'BSE'),
    currency: meta.currency || 'INR',
    price: round(price),
    change: round(change),
    changePercent: round(changePercent),
    dayHigh: round(meta.regularMarketDayHigh),
    dayLow: round(meta.regularMarketDayLow),
    previousClose: round(meta.chartPreviousClose),
    candles,
  };
}

function round(x) {
  if (x == null || Number.isNaN(x)) return null;
  return Math.round(x * 100) / 100;
}
