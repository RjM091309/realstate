import { pool } from '../config/db.js';

/**
 * Active KYC ID-scanner API credentials (Gemini by default).
 * @returns {Promise<{ id: number, apiKey: string, model: string, provider: string } | null>}
 */
export async function getActiveKycScannerApi() {
  const [rows] = await pool.query(
    `
    SELECT id, api_key, model, provider
    FROM kyc_scanner_api
    WHERE active = 1
    ORDER BY id ASC
    LIMIT 1
    `,
  );
  const row = rows[0];
  if (!row) return null;
  const apiKey = String(row.api_key ?? '').trim();
  if (!apiKey) return null;
  return {
    id: Number(row.id),
    apiKey,
    model: String(row.model ?? '').trim() || 'gemini-3.5-flash',
    provider: String(row.provider ?? '').trim() || 'gemini',
  };
}
