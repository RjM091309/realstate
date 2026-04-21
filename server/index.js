import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './config/db.js';
import { ensureSchema } from './ensureSchema.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { unitsRouter } from './routes/unitsRoutes.js';
import { tenantsRouter } from './routes/tenantsRoutes.js';
import { contractsRouter } from './routes/contractsRoutes.js';
import { paymentsRouter } from './routes/paymentsRoutes.js';
import { partnerAgenciesRouter } from './routes/partnerAgenciesRoutes.js';
import { blacklistRouter } from './routes/blacklistRoutes.js';
import { calendarEventsRouter } from './routes/calendarEventsRoutes.js';

const app = express();
const apiPort = Number(process.env.API_PORT ?? 3001);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
// Return JSON for invalid JSON payloads (instead of default HTML)
app.use((err, _req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  next(err);
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      const ms = Date.now() - started;
      console.warn(`[realstate-api] ${res.statusCode} ${req.method} ${req.originalUrl} (${ms}ms)`);
    }
  });
  next();
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: true });
  } catch (e) {
    console.error('Database health check failed:', e);
    res.status(503).json({ ok: false, database: false });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/units', unitsRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/calendar-events', calendarEventsRouter);
app.use('/api/partner-agencies', partnerAgenciesRouter);
app.use('/api/blacklist', blacklistRouter);

void (async () => {
  try {
    await ensureSchema();
    console.log('[realstate-api] Schema OK (branch + role_sidebar_permissions if needed)');
  } catch (e) {
    console.error(
      '[realstate-api] Schema bootstrap failed — check MySQL and that `user_role` exists:',
      e,
    );
  }

  const server = app.listen(apiPort, () => {
    console.log(`[realstate-api] http://127.0.0.1:${apiPort}`);
    console.log(
      '[realstate-api] GET /api/health  POST /api/auth/login  GET /api/auth/session  /api/admin/*  /api/units  /api/tenants  /api/contracts  /api/payments  /api/partner-agencies  /api/blacklist',
    );
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `[realstate-api] Port ${apiPort} is already in use. Stop the other Node process or set API_PORT in .env.`,
      );
    } else {
      console.error('[realstate-api]', err);
    }
    process.exit(1);
  });
})();
