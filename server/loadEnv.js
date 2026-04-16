/**
 * Load `.env` from the project folder (`realstate/.env`) and/or one level up
 * (workspace root, e.g. `../.env` when `realstate` is a subfolder).
 * Later files override earlier ones.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function loadServerEnv() {
  const workspaceRoot = path.join(__dirname, '../../.env');
  const projectRoot = path.join(__dirname, '../.env');
  dotenv.config({ path: workspaceRoot });
  dotenv.config({ path: projectRoot, override: true });
}

/** Run on import so `process.env` is set before `db.ts` and other modules load. */
loadServerEnv();
