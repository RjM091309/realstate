import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import { pool } from './config/db.js';
import { ensureSchema } from './ensureSchema.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { unitsRouter } from './routes/unitsRoutes.js';
import { tenantsRouter } from './routes/tenantsRoutes.js';
import { contractsRouter } from './routes/contractsRoutes.js';
import { paymentsRouter } from './routes/paymentsRoutes.js';

const app = express();
const apiPort = Number(process.env.API_PORT ?? 3001);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
      '[realstate-api] GET /api/health  POST /api/auth/login  GET /api/auth/session  /api/admin/*  /api/units  /api/tenants  /api/contracts  /api/payments',
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
