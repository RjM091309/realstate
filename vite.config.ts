import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, loadEnv} from 'vite';

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  // `.env` sa `realstate/` o isang level pataas (workspace root)
  const env = {
    ...loadEnv(mode, path.resolve(configDir, '..'), ''),
    ...loadEnv(mode, configDir, ''),
  };
  const apiPort = process.env.API_PORT ?? env.API_PORT ?? '2550';
  /** Same proxy for `vite` and `vite preview` so `/api/*` always reaches Express. */
  const apiProxy = {
    '/api': {
      target: `http://127.0.0.1:${apiPort}`,
      changeOrigin: true,
    },
    '/uploads': {
      target: `http://127.0.0.1:${apiPort}`,
      changeOrigin: true,
    },
  };

  return {
    plugins: [react(), tailwindcss()],
    /** Avoid dev-server "Failed to resolve import socket.io-client" when deps cache is stale or incomplete. */
    optimizeDeps: {
      include: ['socket.io-client', 'engine.io-client'],
    },
    resolve: {
      alias: {
        '@': path.resolve(configDir, './src'),
        /** Pin ESM entry — fixes dev-server normalizeUrl failures when package exports resolve oddly. */
        'socket.io-client': path.resolve(
          configDir,
          'node_modules/socket.io-client/build/esm/index.js',
        ),
      },
    },
    server: {
      // UI dev port: 2551 pairs with API on 2550 (see .env.example / ecosystem PM2).
      port: 2551,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: apiProxy,
    },
    preview: {
      port: 2551,
      strictPort: true,
      proxy: apiProxy,
    },
  };
});
