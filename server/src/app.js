import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initStore } from './lib/store.js';
import apiRouter from './routes/api.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api', apiRouter);

// Initialize storage (PostgreSQL if configured, else in-memory).
export async function boot() {
  await initStore();
  return app;
}
