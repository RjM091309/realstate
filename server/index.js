import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { pool } from './config/db.js';
import { ensureSchema, ensureNotificationSchema } from './ensureSchema.js';
import { getJwtSecret } from './jwt.js';
import { loadSessionPayload } from './services/sessionService.js';
import { setIO } from './realtime/io.js';
import { authRouter } from './routes/authRoutes.js';
import { adminRouter } from './routes/adminRoutes.js';
import { unitsRouter } from './routes/unitsRoutes.js';
import { locationBuildingsRouter } from './locationBuildings/locationBuildingsRoutes.js';
import { locationsRouter } from './locations/locationsRoutes.js';
import { tenantsRouter } from './routes/tenantsRoutes.js';
import { contractsRouter } from './routes/contractsRoutes.js';
import { paymentsRouter } from './routes/paymentsRoutes.js';
import { partnerAgenciesRouter } from './routes/partnerAgenciesRoutes.js';
import { blacklistRouter } from './routes/blacklistRoutes.js';
import { calendarEventsRouter } from './routes/calendarEventsRoutes.js';
import { documentsRouter } from './routes/documentsRoutes.js';
import { vendorsRouter } from './routes/vendorsRoutes.js';
import { unitInspectionsRouter } from './routes/unitInspectionsRoutes.js';
import { leaseRenewalsRouter } from './routes/leaseRenewalsRoutes.js';
import { specialRequestsRouter } from './routes/specialRequestsRoutes.js';
import { landlordsRouter } from './routes/landlordsRoutes.js';
import { invoicesRouter } from './routes/invoicesRoutes.js';
import { auditLogsRouter } from './routes/auditLogsRoutes.js';
import { notificationsRouter } from './routes/notificationsRoutes.js';

const app = express();
const apiPort = Number(process.env.API_PORT ?? 2550);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allowed browser origins for cookies/credentialed requests — comma-separated in `.env`.
// Defaults to the local Vite dev/preview origin only; add production origin(s) via CORS_ORIGIN.
const allowedOrigins = String(process.env.CORS_ORIGIN ?? 'http://localhost:2551')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOriginCheck(origin, callback) {
  // No Origin header = same-origin/non-browser request (curl, server-to-server) — allow.
  if (!origin || allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`Origin not allowed by CORS: ${origin}`));
}

app.use(cors({ origin: corsOriginCheck, credentials: true }));
app.use(express.json({ limit: '30mb' }));
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

app.post('/api/system/theme', async (req, res) => {
  const mode = req.body?.mode;
  if (mode !== 'dark' && mode !== 'light') {
    res.status(400).json({ error: 'mode must be "dark" or "light"' });
    return;
  }

  if (process.platform !== 'win32') {
    res.status(400).json({ error: 'System theme switching is only supported on Windows.' });
    return;
  }

  const value = mode === 'dark' ? '0' : '1';
  const personalizePath = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize';

  const runRegAdd = (name) =>
    new Promise((resolve, reject) => {
      execFile(
        'reg',
        ['add', personalizePath, '/v', name, '/t', 'REG_DWORD', '/d', value, '/f'],
        (error, stdout, stderr) => {
          if (error) {
            reject(new Error(stderr || stdout || error.message));
            return;
          }
          resolve();
        },
      );
    });

  try {
    await Promise.all([runRegAdd('AppsUseLightTheme'), runRegAdd('SystemUsesLightTheme')]);
    res.json({ ok: true, mode });
  } catch (error) {
    console.error('[realstate-api] Failed to update system theme:', error);
    const message = error instanceof Error && error.message ? error.message : 'Failed to update system theme.';
    res.status(500).json({ error: message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/units', unitsRouter);
app.use('/api/location-buildings', locationBuildingsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/calendar-events', calendarEventsRouter);
app.use('/api/partner-agencies', partnerAgenciesRouter);
app.use('/api/blacklist', blacklistRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/vendors', vendorsRouter);
app.use('/api/unit-inspections', unitInspectionsRouter);
app.use('/api/lease-renewals', leaseRenewalsRouter);
app.use('/api/special-requests', specialRequestsRouter);
app.use('/api/landlords', landlordsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/notifications', notificationsRouter);

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

  try {
    await ensureNotificationSchema();
    console.log('[realstate-api] Notification feed schema OK (notification_read + notification_feed view)');
  } catch (e) {
    console.error(
      '[realstate-api] Notification schema failed — ensure base tables exist (payment_transaction, lease_contract, …):',
      e,
    );
  }

  const server = http.createServer(app);
  const io = new SocketIOServer(server, {
    cors: { origin: corsOriginCheck, credentials: true },
  });
  setIO(io);

  io.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth ?? {};
      const token = typeof auth.token === 'string' ? auth.token : null;
      const devUserIdRaw = auth.devUserId;

      const allowBypass =
        process.env.NODE_ENV !== 'production' &&
        String(process.env.ALLOW_BYPASS_AUTH ?? 'false').toLowerCase() === 'true';

      let userId = null;
      if (allowBypass && devUserIdRaw != null && String(devUserIdRaw).trim() !== '') {
        userId = Number(String(devUserIdRaw).trim());
      } else if (token) {
        const decoded = jwt.verify(token, getJwtSecret());
        userId = decoded?.userId ?? null;
      }

      if (!Number.isFinite(Number(userId)) || Number(userId) < 1) {
        next(new Error('Unauthorized'));
        return;
      }

      const session = await loadSessionPayload(Number(userId));
      if (!session) {
        next(new Error('Unauthorized'));
        return;
      }

      socket.data.userId = Number(userId);
      socket.data.branchId = Number(session.branchId ?? 1);
      socket.data.roleId = Number(session.role?.id ?? 0);
      next();
    } catch (e) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = Number(socket.data.userId);
    const branchId = Number(socket.data.branchId);
    const roleId = Number(socket.data.roleId);
    socket.join(`user:${userId}`);
    socket.join(`branch:${branchId}`);
    if (Number.isFinite(roleId) && roleId > 0) socket.join(`role:${roleId}`);
  });

  server.listen(apiPort, () => {
    console.log(`[realstate-api] http://127.0.0.1:${apiPort}`);
    console.log(
      '[realstate-api] GET /api/health  POST /api/auth/login  GET /api/auth/session  POST /api/auth/change-password  PATCH /api/auth/profile  POST /api/auth/profile-photo  DELETE /api/auth/profile-photo  POST /api/system/theme  /api/admin/*  /api/units  /api/tenants  /api/contracts  /api/payments  /api/partner-agencies  /api/blacklist  /api/documents  /api/vendors  /api/unit-inspections  /api/special-requests',
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
