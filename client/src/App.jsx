import React, { useEffect, useState, useCallback } from 'react';
import { fetchOverview, fetchStock } from './api/client.js';
import Dashboard from './components/Dashboard.jsx';
import StockDetail from './components/StockDetail.jsx';
import SearchBar from './components/SearchBar.jsx';

export default function App() {
  const [view, setView] = useState('dashboard');
  const [overview, setOverview] = useState(null);
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchOverview();
      setOverview(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, refreshKey]);

  useEffect(() => {
    if (!selectedSymbol) return;
    setStockData(null);
    setError(null);
    fetchStock(selectedSymbol)
      .then(setStockData)
      .catch((e) => setError(e.message));
  }, [selectedSymbol]);

  const openStock = (symbol) => {
    setSelectedSymbol(symbol);
    setView('detail');
  };

  const openSearchedStock = (data) => {
    // data comes resolved from /api/search; show it immediately
    const symbol = data.matchedSymbol || data.symbol;
    setSelectedSymbol(symbol);
    setStockData(data);
    setView('detail');
  };

  const back = () => {
    setView('dashboard');
    setSelectedSymbol(null);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand" onClick={back}>
          <span className="logo">&#9650;</span> StockInsights
          <span className="tag">BSE · NSE</span>
        </div>
        <nav>
          <button
            className={view === 'dashboard' ? 'active' : ''}
            onClick={back}
          >
            Dashboard
          </button>
        </nav>
        <SearchBar
          onPick={openSearchedStock}
          onLoading={setSearchLoading}
          onError={setError}
        />
        <button className="refresh" onClick={() => setRefreshKey((k) => k + 1)}>
          ⟳ Refresh
        </button>
      </header>

      {searchLoading && (
        <div className="banner info">Searching market data…</div>
      )}

      {error && <div className="banner error">⚠ {error}</div>}

      {view === 'detail' && selectedSymbol ? (
        <StockDetail symbol={selectedSymbol} data={stockData} onBack={back} />
      ) : (
        <Dashboard
          loading={loading}
          overview={overview}
          onOpenStock={openStock}
        />
      )}

      <footer className="footer">
        Data via public market feed · Analysis is informational, not financial
        advice.
      </footer>
    </div>
  );
}
