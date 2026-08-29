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

// Locate the built React frontend (client/dist). On Vercel the function's
// files are served from a container (e.g. /var/task), so try several layouts
// to be safe. The build must produce client/dist before the function runs.
function findClientDist() {
  const candidates = [
    // local dev / repo layout: <root>/client/dist
    path.resolve(__dirname, '../../client/dist'),
    // Vercel bundles the repo at /var/task preserving structure
    '/var/task/client/dist',
    // Vercel sometimes places files flat under the handler dir
    path.resolve(__dirname, '../client/dist'),
    path.resolve(__dirname, 'client/dist'),
  ];
  for (const dir of candidates) {
    try {
      if (dir && fs.existsSync(path.join(dir, 'index.html'))) {
        return dir;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

const clientDist = findClientDist();
if (clientDist) {
  console.log(`[server] serving frontend from ${clientDist}`);
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  console.warn(
    '[server] client/dist not found; serving API only. Check the "dist" in .gitignore / includeFiles config.'
  );
}

export async function boot() {
  await initStore();
  return app;
}
