# StockInsights

A web app that gives market insights, technical analysis, and buy/hold/sell
recommendations for **BSE & NSE (Indian) stocks**.

## Features

- **Market overview** — Nifty 50 & Sensex live indices, top gainers/losers
- **Recommendations engine** — per-stock `BUY` / `HOLD` / `SELL` signals
  computed from technical indicators (RSI, MACD, moving averages, momentum,
  volatility, volume) with human-readable reasons
- **Trend & short-term projection** — near-term upside target / downside floor
  and overall market bias
- **Stock detail view** — 6-month price chart vs 20-day SMA + full indicator
  breakdown

## Tech stack

- **Frontend:** React 18 + Vite + Recharts
- **Backend:** Node.js + Express
- **Data source:** Yahoo Finance public chart API (no key required). NSE
  symbols use the `.NS` suffix, BSE use `.BO`.
- **Storage:** PostgreSQL (optional). Falls back to in-memory if not configured.

## How to run

### 1. Start the backend

```bash
cd server
npm install
npm start        # http://localhost:4000
```

Optionally configure PostgreSQL by creating `server/.env` (see
`server/.env.example`):

```
DATABASE_URL=postgres://user:pass@localhost:5432/stockinsights
```

### 2. Start the frontend (separate terminal)

```bash
cd client
npm install
npm run dev      # http://localhost:5173
```

Open http://localhost:5173.

## API endpoints

| Method | Path                     | Description                                    |
| ------ | ------------------------ | ---------------------------------------------- |
| GET    | `/api/market/overview`   | Indices, movers, and all recommendations       |
| GET    | `/api/stock/:symbol`     | Full candle history + analysis for one stock   |
| GET    | `/api/search?q=...`      | Search & analyze any stock by ticker or name   |
| GET    | `/api/watchlist`         | List of tracked symbols                        |
| GET    | `/api/health`            | Health check                                   |

## Customizing the watchlist

Edit `server/src/services/watchlist.js` to add/remove tracked stocks. Use
`.NS` for NSE and `.BO` for BSE.

> **Disclaimer:** This tool provides technical analysis for informational and
> educational purposes only. It is **not** financial or investment advice.
> Always do your own research and consult a licensed advisor before trading.

## Deploying to Vercel

This project is pre-configured for Vercel (`vercel.json`):

- **Frontend** (`client/`) builds as a static site via `@vercel/static-build`
- **Backend** (`api/index.js`) is an Express serverless function, so `/api/*`
  requests hit the same domain as the frontend (no CORS issues).

### Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: stock insights app"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/stock-insights.git
git push -u origin main
```

### Deploy on Vercel

1. Go to https://vercel.com and sign in with your GitHub account.
2. Click **Add New → Project** and import the `stock-insights` repo.
3. Vercel will auto-detect the `vercel.json` config — keep the defaults.
4. Click **Deploy**.

After deployment, open the provided URL (e.g. `https://stock-insights.vercel.app`).

> **Note:** The simplest deploy path is to connect your GitHub repo in the
> Vercel dashboard. You can also use the CLI: `npm i -g vercel && vercel`.

### Optional: enable PostgreSQL on Vercel

By default the app stores data in-memory (fine for this use case, since live
data is pulled on demand). To persist, add a `DATABASE_URL` environment
variable in **Project → Settings → Environment Variables** (e.g. from
Vercel Postgres / Neon / Supabase) and redeploy.
