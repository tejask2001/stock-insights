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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem('si-theme') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('si-theme', theme);
  }, [theme]);

  const loadOverview = useCallback(async (force) => {
    if (force) setRefreshing(true);
    setError(null);
    try {
      const data = await fetchOverview(force);
      setOverview(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedSymbol) return;
    setStockData(null);
    fetchStock(selectedSymbol, true)
      .then(setStockData)
      .catch((e) => setError(e.message));
  }, [selectedSymbol]);

  const refresh = () => {
    setRefreshing(true);
    if (view === 'detail' && selectedSymbol) {
      setError(null);
      fetchStock(selectedSymbol, true)
        .then(setStockData)
        .catch((e) => setError(e.message))
        .finally(() => setRefreshing(false));
    } else {
      loadOverview(true);
    }
  };

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
        <button
          className="refresh"
          onClick={refresh}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          {refreshing ? '⟳ Refreshing…' : '⟳ Refresh'}
        </button>
        <button
          className="theme-toggle"
          onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? '☀' : '☾'}
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
