import { Router } from 'express';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db.js';
import { requireAuth, type AuthedRequest } from './authMiddleware.js';
import { loadSessionPayload, type SessionPayload } from './session.js';

const router = Router();
router.use(requireAuth);

type TenantRow = RowDataPacket & {
  id: string;
  branch_id: number;
  name: string;
  email: string;
  phone: string;
  id_type: string;
  id_number: string;
  id_expiry: Date | string | null;
  id_image_url: string | null;
  kyc_verified: number | boolean;
  is_blacklisted: number | boolean;
  blacklist_reason: string | null;
};

function fmtDate(d: Date | string | null): string {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rowToTenant(row: TenantRow) {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    phone: String(row.phone),
    idType: String(row.id_type),
    idNumber: String(row.id_number),
    idExpiry: row.id_expiry ? fmtDate(row.id_expiry) : '',
    idImageUrl: row.id_image_url ? String(row.id_image_url) : undefined,
    kycVerified: Boolean(Number(row.kyc_verified)),
    isBlacklisted: Boolean(Number(row.is_blacklisted)),
    blacklistReason: row.blacklist_reason ? String(row.blacklist_reason) : undefined,
  };
}

function validatePayload(body: Record<string, unknown>): {
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  idExpiry: string | null;
  idImageUrl: string | null;
  kycVerified: boolean;
  isBlacklisted: boolean;
  blacklistReason: string | null;
} | null {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const idType = String(body.idType ?? '').trim();
  const idNumber = String(body.idNumber ?? '').trim();
  if (!name || !email || !phone || !idType || !idNumber) return null;

  const idExpiryRaw = body.idExpiry;
  let idExpiry: string | null = null;
  if (idExpiryRaw !== null && idExpiryRaw !== undefined && String(idExpiryRaw).trim() !== '') {
    const s = String(idExpiryRaw).trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    idExpiry = s;
  }

  const idImageUrlRaw = body.idImageUrl;
  const idImageUrl =
    idImageUrlRaw === null || idImageUrlRaw === undefined || String(idImageUrlRaw).trim() === ''
      ? null
      : String(idImageUrlRaw).trim();

  const kycVerified = body.kycVerified === undefined ? true : Boolean(body.kycVerified);
  const isBlacklisted = Boolean(body.isBlacklisted);
  const blacklistReasonRaw = body.blacklistReason;
  const blacklistReason =
    blacklistReasonRaw === null || blacklistReasonRaw === undefined
      ? null
      : String(blacklistReasonRaw).trim() || null;

  return {
    name,
    email,
    phone,
    idType,
    idNumber,
    idExpiry,
    idImageUrl,
    kycVerified,
    isBlacklisted,
    blacklistReason,
  };
}

function canCrud(session: SessionPayload, op: 'create' | 'update' | 'delete'): boolean {
  const m = session.crud?.crm;
  if (!m) return false;
  if (op === 'create') return Boolean(m.create);
  if (op === 'update') return Boolean(m.update);
  return Boolean(m.delete);
}

router.get('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, name, email, phone, id_type, id_number, id_expiry, id_image_url,
              kyc_verified, is_blacklisted, blacklist_reason
       FROM crm_tenant WHERE branch_id = ? ORDER BY name ASC`,
      [session.branchId],
    );
    const tenants = (rows as TenantRow[]).map(rowToTenant);
    res.json({ tenants });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load tenants' });
  }
});

router.post('/', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canCrud(session, 'create')) {
    res.status(403).json({ error: 'No permission to create tenants' });
    return;
  }
  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid tenant payload' });
    return;
  }
  // `crm_tenant.id` is VARCHAR(36); use raw UUID (36 chars).
  // Prefixed IDs like `t-${uuid}` become 38 chars and get truncated by MySQL,
  // which makes the follow-up SELECT miss the just-inserted row.
  const id = crypto.randomUUID();
  try {
    await pool.query(
      `INSERT INTO crm_tenant (
        id, branch_id, name, email, phone, id_type, id_number, id_expiry, id_image_url,
        kyc_verified, is_blacklisted, blacklist_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        session.branchId,
        parsed.name,
        parsed.email,
        parsed.phone,
        parsed.idType,
        parsed.idNumber,
        parsed.idExpiry,
        parsed.idImageUrl,
        parsed.kycVerified ? 1 : 0,
        parsed.isBlacklisted ? 1 : 0,
        parsed.blacklistReason,
      ],
    );
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, name, email, phone, id_type, id_number, id_expiry, id_image_url,
              kyc_verified, is_blacklisted, blacklist_reason
       FROM crm_tenant WHERE id = ? AND branch_id = ? LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as TenantRow[])[0];
    if (!row) {
      res.status(500).json({ error: 'Failed to load created tenant' });
      return;
    }
    res.status(201).json({ tenant: rowToTenant(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

router.patch('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canCrud(session, 'update')) {
    res.status(403).json({ error: 'No permission to update tenants' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const parsed = validatePayload(req.body as Record<string, unknown>);
  if (!parsed) {
    res.status(400).json({ error: 'Invalid tenant payload' });
    return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE crm_tenant SET
        name = ?, email = ?, phone = ?, id_type = ?, id_number = ?, id_expiry = ?, id_image_url = ?,
        kyc_verified = ?, is_blacklisted = ?, blacklist_reason = ?
       WHERE id = ? AND branch_id = ?`,
      [
        parsed.name,
        parsed.email,
        parsed.phone,
        parsed.idType,
        parsed.idNumber,
        parsed.idExpiry,
        parsed.idImageUrl,
        parsed.kycVerified ? 1 : 0,
        parsed.isBlacklisted ? 1 : 0,
        parsed.blacklistReason,
        id,
        session.branchId,
      ],
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, branch_id, name, email, phone, id_type, id_number, id_expiry, id_image_url,
              kyc_verified, is_blacklisted, blacklist_reason
       FROM crm_tenant WHERE id = ? AND branch_id = ? LIMIT 1`,
      [id, session.branchId],
    );
    const row = (rows as TenantRow[])[0];
    if (!row) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({ tenant: rowToTenant(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

router.delete('/:id', async (req, res) => {
  const userId = (req as AuthedRequest).userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  if (!canCrud(session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete tenants' });
    return;
  }
  const id = String(req.params.id ?? '').trim();
  if (!id) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const [result] = await pool.query<ResultSetHeader>(
      'DELETE FROM crm_tenant WHERE id = ? AND branch_id = ?',
      [id, session.branchId],
    );
    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

export { router as tenantsRouter };
