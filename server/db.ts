import mysql from 'mysql2/promise';

const port = Number(process.env.DATABASE_PORT ?? 3306);

export const pool = mysql.createPool({
  host: process.env.DATABASE_HOST ?? '127.0.0.1',
  port: Number.isFinite(port) ? port : 3306,
  user: process.env.DATABASE_USER ?? 'root',
  password: process.env.DATABASE_PASSWORD ?? '',
  database: process.env.DATABASE_NAME ?? 'realstate',
  waitForConnections: true,
  connectionLimit: 10,
});
