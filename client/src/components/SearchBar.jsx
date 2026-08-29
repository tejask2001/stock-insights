import React, { useRef, useState, useEffect } from 'react';
import { searchStock } from '../api/client.js';

// These are shown as autocomplete suggestions while typing.
// Keys are company names, values are Yahoo symbols.
const SUGGESTIONS = [
  { label: 'Reliance Industries', symbol: 'RELIANCE.NS' },
  { label: 'Tata Consultancy Services', symbol: 'TCS.NS' },
  { label: 'Infosys', symbol: 'INFY.NS' },
  { label: 'HDFC Bank', symbol: 'HDFCBANK.NS' },
  { label: 'ICICI Bank', symbol: 'ICICIBANK.NS' },
  { label: 'State Bank of India', symbol: 'SBIN.NS' },
  { label: 'Tata Motors', symbol: 'TATAMOTORS.NS' },
  { label: 'Bajaj Finance', symbol: 'BAJFINANCE.NS' },
  { label: 'Titan', symbol: 'TITAN.NS' },
  { label: 'Wipro', symbol: 'WIPRO.NS' },
  { label: 'Adani Enterprises', symbol: 'ADANIENT.NS' },
  { label: 'Asian Paints', symbol: 'ASIANPAINT.NS' },
  { label: 'Larsen & Toubro', symbol: 'LT.NS' },
  { label: 'Sun Pharma', symbol: 'SUNPHARMA.NS' },
  { label: 'Tata Steel', symbol: 'TATASTEEL.NS' },
  { label: 'ITC', symbol: 'ITC.NS' },
  { label: 'Kotak Mahindra Bank', symbol: 'KOTAKBANK.NS' },
  { label: 'Mahindra & Mahindra', symbol: 'M&M.NS' },
  { label: 'NTPC', symbol: 'NTPC.NS' },
  { label: 'Coal India', symbol: 'COALINDIA.NS' },
];

export default function SearchBar({ onPick, onLoading, onError, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = q
    ? SUGGESTIONS.filter(
        (s) =>
          s.label.toLowerCase().includes(q) ||
          s.symbol.replace('.NS', '').replace('.BO', '').toLowerCase().includes(q)
      ).slice(0, 8)
    : SUGGESTIONS.slice(0, 6);

  async function submit(value) {
    const term = value || query;
    if (!term.trim()) return;
    setOpen(false);
    setBusy(true);
    onLoading?.(true);
    onError?.(null);
    try {
      const data = await searchStock(term);
      onPick(data);
    } catch (e) {
      onError?.(e.message);
    } finally {
      setBusy(false);
      onLoading?.(false);
    }
  }

  return (
    <div className="search-box" ref={boxRef}>
      <div className="search-input-wrap">
        <input
          className="search-input"
          value={query}
          placeholder="Search any stock (e.g. Titan, TCS, WIPRO)…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
        <button className="search-btn" onClick={() => submit()} disabled={busy}>
          {busy ? '…' : '🔍'}
        </button>
      </div>
      {open && (
        <div className="search-dropdown">
          {matches.length === 0 && (
            <div className="search-empty">
              Search "{query}" — press Enter to analyze on NSE/BSE
            </div>
          )}
          {matches.map((m) => (
            <button
              key={m.symbol}
              className="search-item"
              onClick={() => {
                setQuery(m.symbol);
                submit(m.symbol);
              }}
            >
              <span className="search-label">{m.label}</span>
              <span className="search-symbol">
                {m.symbol.replace('.NS', '').replace('.BO', '')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
