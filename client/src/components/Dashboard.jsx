import React from 'react';

const actionColor = {
  BUY: 'buy',
  HOLD: 'hold',
  SELL: 'sell',
};

export default function Dashboard({ loading, overview, onOpenStock }) {
  if (loading) {
    return (
      <div className="container center">
        <div className="spinner" />
        <p>Gathering live market data &amp; running analysis…</p>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="container center">
        <p>No market data available yet.</p>
      </div>
    );
  }

  const rec = overview.recommendations || [];
  const buy = rec.filter((r) => r.action === 'BUY');
  const sell = rec.filter((r) => r.action === 'SELL');
  const hold = rec.filter((r) => r.action === 'HOLD');

  return (
    <div className="container">
      {/* Indices */}
      <section>
        <h2>Market Indices</h2>
        <div className="card-grid indices">
          {(overview.indices || []).map((idx) => (
            <div key={idx.symbol} className="card index">
              <div className="label">{idx.name}</div>
              <div className="big-price">₹{idx.price?.toLocaleString('en-IN')}</div>
              <div className={idx.changePercent >= 0 ? 'pos' : 'neg'}>
                {idx.changePercent >= 0 ? '▲' : '▼'}{' '}
                {Math.abs(idx.changePercent).toFixed(2)}%
              </div>
              <div className="muted">High {idx.dayHigh} · Low {idx.dayLow}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Truncated composite signal banner */}
      <section>
        <div className="summary-grid">
          <div className="summary-card">
            <div className="label">Buy signals</div>
            <div className="count buy-text">{buy.length}</div>
          </div>
          <div className="summary-card">
            <div className="label">Hold</div>
            <div className="count hold-text">{hold.length}</div>
          </div>
          <div className="summary-card">
            <div className="label">Sell signals</div>
            <div className="count sell-text">{sell.length}</div>
          </div>
          <div className="summary-card">
            <div className="label">Stocks tracked</div>
            <div className="count">{rec.length}</div>
          </div>
        </div>
      </section>

      {/* Market movers */}
      <div className="two-col">
        <section>
          <h2>Top Gainers</h2>
          <MoverList rows={overview.movers?.gainers} onOpenStock={onOpenStock} swap="pos" />
        </section>
        <section>
          <h2>Top Losers</h2>
          <MoverList rows={overview.movers?.losers} onOpenStock={onOpenStock} swap="neg" />
        </section>
      </div>

      {/* Recommendations */}
      <section>
        <h2>Recommendations — what to hold, buy, or sell</h2>
        <p className="muted">
          Computed from technical indicators (RSI, MACD, moving averages,
          momentum &amp; volume). Click any stock for a detailed breakdown.
        </p>
        <RecommendationTable rows={rec} onOpenStock={onOpenStock} />
      </section>
    </div>
  );
}

function MoverList({ rows, onOpenStock, swap }) {
  if (!rows || !rows.length)
    return <div className="card muted">No data.</div>;
  return (
    <div className="card list">
      {rows.map((s) => {
        const pct = s.changePercent ?? 0;
        return (
          <button
            key={s.symbol}
            className="row-btn"
            onClick={() => onOpenStock(s.symbol)}
          >
            <div>
              <div className="row-name">{s.name}</div>
              <div className="muted small">{s.symbol}</div>
            </div>
            <div className="row-right">
              <div className="row-price">₹{s.price ?? '—'}</div>
              <div className={pct >= 0 ? 'pos' : 'neg'}>
                {pct >= 0 ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function RecommendationTable({ rows, onOpenStock }) {
  return (
    <div className="card table-wrap">
      <table className="rec-table">
        <thead>
          <tr>
            <th>Stock</th>
            <th>Signal</th>
            <th>Trend</th>
            <th>RSI</th>
            <th>Target</th>
            <th>Confidence</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} onClick={() => onOpenStock(r.symbol)}>
              <td>
                <div className="row-name">{r.name}</div>
                <div className="muted small">
                  {r.symbol.replace('.NS', '').replace('.BO', '')} · {r.sector}
                </div>
              </td>
              <td>
                <span className={`badge ${actionColor[r.action]}`}>
                  {r.action}
                </span>
              </td>
              <td>{r.trend || '—'}</td>
              <td>{r.rsi != null ? r.rsi.toFixed(0) : '—'}</td>
              <td>
                {r.bias === 'Upward' ? '▲ ' : r.bias === 'Downward' ? '▼ ' : ''}
                {r.target != null ? `₹${r.target.toFixed(0)}` : '—'}
              </td>
              <td>{r.confidence}</td>
              <td className="small muted">{r.reasons.slice(0, 2).join('; ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
