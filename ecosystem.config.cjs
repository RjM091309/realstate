/**
 * PM2 — development only.
 * Loads `.env` from project root (same as `npm run dev:api` / server).
 * API on 2550 (API_PORT), Vite UI on 2551 — see vite.config.ts and `.env`.
 *
 *   pm2 start ecosystem.config.cjs
 *   pm2 logs
 *   pm2 delete ecosystem.config.cjs
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const devApiPort = process.env.API_PORT || '2550';

const envFromDotenv = {};
for (const key of [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'API_PORT',
  'JWT_SECRET',
  'ALLOW_BYPASS_AUTH',
]) {
  if (process.env[key] !== undefined) envFromDotenv[key] = process.env[key];
}

const baseEnv = {
  NODE_ENV: 'development',
  API_PORT: devApiPort,
  ...envFromDotenv,
};

module.exports = {
  apps: [
    {
      name: 'realstate-api-dev',
      cwd: __dirname,
      script: 'server/index.js',
      interpreter: 'node',
      // Watch code only — never `server/uploads` (KYC uploads were restarting the API mid-request).
      watch: [
        'server/controllers',
        'server/routes',
        'server/models',
        'server/services',
        'server/middlewares',
        'server/config',
        'server/realtime',
        'server/locations',
        'server/locationBuildings',
        'server/index.js',
        'server/ensureSchema.js',
        'server/loadEnv.js',
        'server/jwt.js',
        'server/accessConfig.js',
      ],
      ignore_watch: ['node_modules', '**/*.log', '**/.*'],
      env: { ...baseEnv },
    },
    {
      name: 'realstate-dev',
      cwd: __dirname,
      script: 'node_modules/vite/bin/vite.js',
      args: '--host=0.0.0.0 --port=2551 --strictPort',
      interpreter: 'node',
      env: { ...baseEnv },
    },
  ],
};
