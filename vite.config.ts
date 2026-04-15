import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig, loadEnv} from 'vite';

const configDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  // `.env` sa `realstate/` o isang level pataas (workspace root)
  const env = {
    ...loadEnv(mode, path.resolve(configDir, '..'), ''),
    ...loadEnv(mode, configDir, ''),
  };
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      // UI dev port: avoid 6000 — Chrome blocks it (X11 / ERR_UNSAFE_PORT). 6001 is fine.
      port: 6001,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${env.API_PORT ?? '3001'}`,
          changeOrigin: true,
        },
      },
    },
  };
});
