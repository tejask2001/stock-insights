import 'dotenv/config';

// Vercel sets a fully-qualified origin; local dev uses localhost:5173.
// CORS is handled by Vercel's rewrites/proxy, so the backend can stay open.
export const config = {
  port: process.env.PORT || 4000,
  databaseUrl: process.env.DATABASE_URL || '',
  // Allow any origin during deployed/serverless usage (frontend is proxied).
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dataRefreshMs: Number(process.env.DATA_REFRESH_MS || 5 * 60 * 1000),
  fundamentals: {
    provider: process.env.FUNDAMENTALS_PROVIDER || '', // 'bharatstock' | 'fmp' | ''
    bharatstockKey: process.env.BHARATSTOCK_API_KEY || '',
    bharatstockBase: process.env.BHARATSTOCK_BASE_URL || 'https://bharatstockapi.com',
    fmpKey: process.env.FMP_API_KEY || '',
  },
};
