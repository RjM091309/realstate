import '../loadEnv.js';
import mysql from 'mysql2/promise';

/** Values: `DATABASE_*` from project `.env` (copy `.env.example` → `.env`). */
const port = Number(process.env.DATABASE_PORT ?? 3306);
const user = process.env.DATABASE_USER?.trim();
if (!user) {
  throw new Error(
    '[db] Missing DATABASE_USER. Copy `.env.example` to `.env` and set DATABASE_HOST, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME.',
  );
}

export const pool = mysql.createPool({
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: Number.isFinite(port) ? port : 3306,
  user,
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'realstate',
  waitForConnections: true,
  connectionLimit: 10,
  // Keep DATE/DATETIME as strings so calendar/ledger dues don't shift by timezone.
  dateStrings: true,
});

