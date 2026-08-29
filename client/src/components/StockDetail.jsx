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
        <h2>Price history (1 year) vs 20-day SMA</h2>
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
        <h2>Short-term outlook ({proj.horizon || '1-2 weeks'})</h2>
        <div className="card outlook">
          <div className="outlook-row">
            <div>Bias: <b>{proj.bias}</b></div>
            <div>Expected range: <b>₹{proj.projectedLow ?? '—'} – ₹{proj.projectedHigh ?? '—'}</b></div>
            <div>
              Expected move:{' '}
              <b className={proj.expectedReturn >= 0 ? 'pos' : 'neg'}>
                {proj.expectedReturn != null ? `${proj.expectedReturn >= 0 ? '+' : ''}${proj.expectedReturn.toFixed(1)}%` : '—'}
              </b>
            </div>
          </div>
        </div>
      </section>

      {/* 1-2 week summary */}
      <section>
        <h2>What to expect in the next 1-2 weeks</h2>
        <div className="card">
          <p className="sum-text">{proj.summary}</p>
          <div className="outlook-row">
            <div>Upside to <b>₹{proj.shortTermTarget ?? '—'}</b> ({proj.upReturnPct != null ? `${proj.upReturnPct >= 0 ? '+' : ''}${proj.upReturnPct.toFixed(1)}%` : '—'})</div>
            <div>Downside to <b>₹{proj.shortTermFloor ?? '—'}</b> ({proj.downReturnPct != null ? `${proj.downReturnPct >= 0 ? '+' : ''}${proj.downReturnPct.toFixed(1)}%` : '—'})</div>
            <div>Indicators: RSI {ind.rsi != null ? ind.rsi.toFixed(1) : '—'} · MACD {sign(ind.macd, ind.macdSignal)}</div>
          </div>
        </div>
      </section>

      {data.score && (
        <>
          {/* Composite score */}
          <section>
            <h2>Composite score (0-100)</h2>
            <div className="card">
              <div className="score-head">
                <div className="score-big">{data.score.overall ?? '—'}</div>
                <div className="score-rating">{data.score.rating}</div>
                <div className="score-factors muted small">
                  Strongest: {data.score.strongest ? `${data.score.strongest.name} (${Math.round(data.score.strongest.score)})` : '—'}
                  {' · '}
                  Weakest: {data.score.weakest ? `${data.score.weakest.name} (${Math.round(data.score.weakest.score)})` : '—'}
                </div>
              </div>

              {data.score.categories.map((cat) => (
                <div className="cat" key={cat.group}>
                  <div className="cat-head">
                    <span className="cat-name">{cat.group}</span>
                    <span className="cat-score">
                      {cat.score != null ? Math.round(cat.score) : 'N/A'}
                    </span>
                  </div>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{ width: `${cat.score != null ? cat.score : 0}%` }}
                    />
                  </div>
                  <div className="cat-params">
                    {cat.params.map((p) => (
                      <div className="cat-param" key={p.name}>
                        <span className="muted small">{p.name}</span>
                        <span>
                          {p.score != null ? Math.round(p.score) : 'N/A'}
                          {p.value ? ` (${p.value})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 30-day probability outlook */}
          {data.score.outlook && (
            <section>
              <h2>30-trading-day probability outlook</h2>
              <div className="card">
                <div className="outlook-row">
                  <div>Bias: <b>{data.score.outlook.bias}</b></div>
                  <div>Conviction: <b>{data.score.outlook.conviction}</b></div>
                  <div>Expected price: <b>₹{data.score.outlook.expectedPrice ?? '—'}</b> ({fmtPct(data.score.outlook.expectedReturnPct)})</div>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>
                  Projected range: ₹{data.score.outlook.projectedRange?.low ?? '—'} – ₹{data.score.outlook.projectedRange?.high ?? '—'}
                </div>
                <p className="sum-text">{data.score.outlook.headline}</p>

                <div className="prob">
                  <div className={`prob-cell prob-up`}>
                    <div className="prob-label">Up</div>
                    <div className="prob-val">{pctProb(data.score.outlook.probability?.up)}</div>
                  </div>
                  <div className={`prob-cell prob-flat`}>
                    <div className="prob-label">Flat</div>
                    <div className="prob-val">{pctProb(data.score.outlook.probability?.flat)}</div>
                  </div>
                  <div className={`prob-cell prob-down`}>
                    <div className="prob-label">Down</div>
                    <div className="prob-val">{pctProb(data.score.outlook.probability?.down)}</div>
                  </div>
                </div>

                <h3 className="muted small" style={{ margin: '14px 0 6px' }}>Key risks</h3>
                <ul className="reasons">
                  {(data.score.outlook.risks || []).map((r, i) => <li key={i}>{r}</li>)}
                </ul>
                <h3 className="muted small" style={{ margin: '14px 0 6px' }}>Assumptions</h3>
                <ul className="reasons">
                  {(data.score.assumptions || []).map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            </section>
          )}
        </>
      )}

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

function fmtPct(v) {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function pctProb(v) {
  if (v == null) return '—';
  return `${(v * 100).toFixed(0)}%`;
}
