import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import pool, { runMigrations, seedAdmin } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '2mb' }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// ---------------------------------------------------------------------------
// API routes — dynamically imported so they can be added incrementally
// ---------------------------------------------------------------------------

async function mountRoutes() {
  const routeModules = [
    { path: '/api/auth',         file: './routes/auth.js' },
    { path: '/api/users',        file: './routes/users.js' },
    { path: '/api/companies',    file: './routes/companies.js' },
    { path: '/api',              file: './routes/accounts.js' },
    { path: '/api/infractions',  file: './routes/infractions.js' },
    { path: '/api/dashboard',    file: './routes/dashboard.js' },
    { path: '/api/mailing-list', file: './routes/mailingList.js' },
    { path: '/api/reports',       file: './routes/reports.js' },
    { path: '/api/admin',        file: './routes/admin.js' },
  ];

  for (const route of routeModules) {
    try {
      const mod = await import(route.file);
      app.use(route.path, mod.default);
      console.log(`[SERVER] Mounted ${route.path}`);
    } catch (err) {
      // Route file doesn't exist yet — that's fine during incremental dev
      if (err.code === 'ERR_MODULE_NOT_FOUND') {
        console.log(`[SERVER] Route not found, skipping: ${route.file}`);
      } else {
        console.error(`[SERVER] Error loading ${route.file}:`, err.message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Static files & SPA fallback (production)
// ---------------------------------------------------------------------------

const clientDist = path.resolve(__dirname, '..', 'client', 'dist');

app.use(express.static(clientDist));

app.get('*', (req, res, next) => {
  // Don't catch API routes
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) next();
  });
});

// ---------------------------------------------------------------------------
// Scheduler (lazy-loaded)
// ---------------------------------------------------------------------------

async function startScheduler() {
  try {
    const mod = await import('./services/scheduler.js');
    if (typeof mod.startScheduler === 'function') mod.startScheduler();
    else if (typeof mod.default === 'function') mod.default();
    else if (typeof mod.start === 'function') mod.start();
    console.log('[SERVER] Scheduler started');
  } catch (err) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.log('[SERVER] Scheduler module not found, skipping');
    } else {
      console.error('[SERVER] Scheduler error:', err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function boot() {
  try {
    await runMigrations();
    await seedAdmin();
    await mountRoutes();
    await startScheduler();

    app.listen(PORT, () => {
      console.log(`[SERVER] IP Sentinel listening on port ${PORT}`);
    });
  } catch (err) {
    console.error('[SERVER] Fatal startup error:', err);
    process.exit(1);
  }
}

boot();
