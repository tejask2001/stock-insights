import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { initStore } from './lib/store.js';
import apiRouter from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());

app.get('/api/health', (req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);
app.use('/api', apiRouter);

// Serve the built React frontend.
// In production (Vercel) the client build is expected at client/dist.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

export async function boot() {
  await initStore();
  return app;
}
