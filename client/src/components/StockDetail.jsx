import React, { useMemo } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Area,
} from 'recharts';

const actionColor = { BUY: 'buy', HOLD: 'hold', SELL: 'sell' };

export default function StockDetail({ symbol, data, onBack }) {
  const chartData = useMemo(() => {
    if (!data?.candles) return [];
    // build rows with SMA20 overlay for charting
    const closes = data.candles.map((c) => c.close);
    const sma20 = [];
    let sum = 0;
    for (let i = 0; i < closes.length; i++) {
      sum += closes[i];
      if (i >= 20) sum -= closes[i - 20];
      sma20.push(i >= 19 ? Math.round((sum / 20) * 100) / 100 : null);
    }
    return data.candles.map((c, i) => ({
      date: new Date(c.date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
      }),
      close: c.close,
      sma20: sma20[i],
    }));
  }, [data]);

  if (!data) {
    return (
      <div className="container center">
        <div className="spinner" />
        <p>Loading {symbol}…</p>
      </div>
    );
  }

  const an = data.analysis || {};
  const ind = an.indicators || {};
  const sig = an.signal || {};
  const trend = an.trend || {};
  const proj = an.projection || {};

  return (
    <div className="container">
      <button className="back" onClick={onBack}>← Back to dashboard</button>

      <div className="detail-head">
        <div>
          <h1>
            {data.companyName}{' '}
            <span className="muted">{data.symbol}</span>
          </h1>
          <div className="muted">
            {data.exchange} · {data.currency}
          </div>
        </div>
        <div className="detail-price">
          <div className="big-price">₹{data.price?.toLocaleString('en-IN')}</div>
          <div className={data.changePercent >= 0 ? 'pos' : 'neg'}>
            {data.changePercent >= 0 ? '▲' : '▼'} ₹{Math.abs(data.change)} (
            {Math.abs(data.changePercent).toFixed(2)}%)
          </div>
        </div>
      </div>

      {/* Chart */}
      <section>
        <h2>Price history (6 months) vs 20-day SMA</h2>
        <div className="card chart">
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} minTickGap={30} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--chart-tick)', fontSize: 11 }} width={60} />
              <Tooltip
                contentStyle={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--tooltip-label)' }}
              />
              <Area type="monotone" dataKey="close" stroke="#22c55e" fill="var(--green)" fillOpacity={0.08} name="Close" />
              <Line type="monotone" dataKey="sma20" stroke="#f59e0b" dot={false} strokeDasharray="4 4" name="SMA20" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Signal verdict */}
      <section>
        <h2>Trading signal</h2>
        <div className="card verdict">
          <div className={`verdict-badge badge ${actionColor[sig.action]}`}>
            {sig.action}
          </div>
          <div>
            <div className="label">
              Confidence: {sig.confidence} (score {sig.score})
            </div>
            <div className="muted">{proj.summary}</div>
            <ul className="reasons">
              {sig.reasons?.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Indicator grid */}
      <section>
        <h2>Indicators</h2>
        <div className="ind-grid">
          <Ind label="RSI (14)" value={ind.rsi != null ? ind.rsi.toFixed(1) : '—'} sub={trend.rsiStatus} />
          <Ind label="MACD vs Signal" value={sign(ind.macd, ind.macdSignal)} sub={trend.macdStatus} />
          <Ind label="Momentum (14d)" value={ind.momentum != null ? `${ind.momentum >= 0 ? '+' : ''}${ind.momentum.toFixed(1)}` : '—'} sub={trend.momentum} />
          <Ind label="ROC (10d)" value={ind.roc != null ? `${ind.roc.toFixed(1)}%` : '—'} />
          <Ind label="20-day SMA" value={ind.sma20 != null ? `₹${ind.sma20.toFixed(0)}` : '—'} sub={`off ${pctFrom(ind.price, ind.sma20)}%`} />
          <Ind label="50-day SMA" value={ind.sma50 != null ? `₹${ind.sma50.toFixed(0)}` : '—'} sub={`off ${pctFrom(ind.price, ind.sma50)}%`} />
          <Ind label="Volatility (ATR)" value={ind.volatility != null ? `${ind.volatility.toFixed(1)}%` : '—'} sub="intraday risk" />
          <Ind label="Support" value={ind.support != null ? `₹${ind.support.toFixed(0)}` : '—'} />
          <Ind label="Resistance" value={ind.resistance != null ? `₹${ind.resistance.toFixed(0)}` : '—'} />
          <Ind label="Volume trend" value={ind.volumeSpike ? 'Spike' : 'Normal'} sub={`${ind.avgVolume?.toLocaleString() || ''} avg`} />
        </div>
      </section>

      {/* Outlook */}
      <section>
        <h2>Short-term outlook</h2>
        <div className="card outlook">
          <div className="label">Bias: {proj.bias}</div>
          <div className="muted">{proj.summary}</div>
          <div className="outlook-row">
            <div>Upside target: <b>₹{proj.shortTermTarget ?? '—'}</b></div>
            <div>Downside floor: <b>₹{proj.shortTermFloor ?? '—'}</b></div>
          </div>
        </div>
      </section>

      <div className="muted small note">
        Analysis is generated from technical indicators on historical price
        data and is informational only — not investment advice.
      </div>
    </div>
  );
}

function Ind({ label, value, sub }) {
  return (
    <div className="card ind">
      <div className="label small">{label}</div>
      <div className="ind-value">{value}</div>
      {sub && <div className="muted small">{sub}</div>}
    </div>
  );
}

function sign(a, b) {
  if (a == null || b == null) return '—';
  const diff = a - b;
  return diff > 0 ? 'Bullish' : diff < 0 ? 'Bearish' : 'Flat';
}

function pctFrom(price, base) {
  if (price == null || base == null || base === 0) return '—';
  return ((price - base) / base) * 100;
}
