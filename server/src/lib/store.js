import pg from 'pg';
import { config } from '../config.js';

// In-memory store used when PostgreSQL is not configured (fallback).
const memStocks = new Map();

let client = null;
let usePg = false;

export async function initStore() {
  if (config.databaseUrl) {
    try {
      client = new pg.Client({ connectionString: config.databaseUrl });
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS stocks (
          symbol TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      usePg = true;
      console.log('[db] PostgreSQL connected.');
    } catch (err) {
      console.warn('[db] PostgreSQL unavailable, falling back to in-memory:', err.message);
      client = null;
    }
  } else {
    console.log('[db] DATABASE_URL not set, using in-memory storage.');
  }
}

export async function saveStock(symbol, payload) {
  const row = JSON.stringify({ data: payload, fetchedAt: new Date().toISOString() });
  if (usePg) {
    await client.query(
      `INSERT INTO stocks (symbol, data, fetched_at)
       VALUES ($1, $2, now())
       ON CONFLICT (symbol) DO UPDATE SET data = EXCLUDED.data, fetched_at = now()`,
      [symbol, row]
    );
  } else {
    memStocks.set(symbol, row);
  }
}

export async function loadStock(symbol) {
  if (usePg) {
    const res = await client.query('SELECT data FROM stocks WHERE symbol = $1', [symbol]);
    if (res.rows.length) return JSON.parse(res.rows[0].data);
    return null;
  }
  const raw = memStocks.get(symbol);
  return raw ? JSON.parse(raw) : null;
}
