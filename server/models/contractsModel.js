import { pool } from '../config/db.js';

function contractNoPrefixFromStartDate(startDateRaw) {
  const s = String(startDateRaw ?? '').trim().slice(0, 10);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = m[1];
  const month = m[2];
  // format requested: YYYYMM-#### (e.g. Apr 30 2026 → 202604-0001)
  return `${year}${month}-`;
}

async function generateNextContractNo(conn, branchId, startDateRaw) {
  const prefix = contractNoPrefixFromStartDate(startDateRaw);
  if (!prefix) throw new Error('Invalid startDate for contract_no generation');

  const like = `${prefix}%`;
  // Lock the latest row for this prefix to avoid concurrent duplicates.
  const [rows] = await conn.query(
    `
    SELECT contract_no
    FROM lease_contract
    WHERE branch_id = ? AND contract_no LIKE ?
    ORDER BY contract_no DESC
    LIMIT 1
    FOR UPDATE
    `,
    [branchId, like],
  );

  const last = rows?.[0]?.contract_no ? String(rows[0].contract_no) : '';
  const lastSeq = last.startsWith(prefix) ? Number(last.slice(prefix.length)) : 0;
  const nextSeq = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq + 1 : 1;
  const seq4 = String(nextSeq).padStart(4, '0');
  return `${prefix}${seq4}`;
}

export async function listContractsByBranch(branchId) {
  const [rows] = await pool.query(
    `SELECT
        c.id,
        c.branch_id,
        c.contract_no,
        c.unit_id,
        ct.tenant_id,
        c.agent_id,
        c.start_date,
        c.end_date,
        c.monthly_rent,
        c.security_deposit,
        c.advance_rent,
        c.contract_type,
        c.status,
        c.special_remarks AS remarks
     FROM lease_contract c
     LEFT JOIN contract_tenant ct
       ON ct.contract_id = c.id AND ct.is_primary = 1
     WHERE c.branch_id = ?
     ORDER BY c.created_at DESC`,
    [branchId],
  );
  return rows;
}

export async function insertContract(branchId, payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const contractNo = await generateNextContractNo(conn, branchId, payload.startDate);
    const [result] = await conn.query(
      `INSERT INTO lease_contract (
        branch_id, contract_no, unit_id, agent_id, start_date, end_date,
        monthly_rent, security_deposit, advance_rent, contract_type, status, special_remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        branchId,
        contractNo,
        payload.unitId,
        payload.agentId,
        payload.startDate,
        payload.endDate,
        payload.monthlyRent,
        payload.securityDeposit,
        payload.advanceRent,
        payload.type,
        payload.status,
        payload.remarks,
      ],
    );

    const contractId = result.insertId;
    await conn.query(
      `INSERT INTO contract_tenant (contract_id, tenant_id, is_primary) VALUES (?, ?, 1)`,
      [contractId, payload.tenantId],
    );

    // When a lease becomes active, the unit should no longer be available.
    // Keep drafts from affecting inventory, but treat active leases as occupied.
    if (String(payload.status).toLowerCase() === 'active') {
      await conn.query(
        `UPDATE unit u
         JOIN property pr ON pr.id = u.property_id
         SET u.status = 'occupied'
         WHERE u.id = ? AND pr.branch_id = ?`,
        [payload.unitId, branchId],
      );
    }

    await conn.commit();
    return getContractById(contractId, branchId);
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function updateContractById(id, branchId, payload) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `UPDATE lease_contract SET
        unit_id = ?,
        agent_id = ?,
        start_date = ?,
        end_date = ?,
        monthly_rent = ?,
        security_deposit = ?,
        advance_rent = ?,
        contract_type = ?,
        status = ?,
        special_remarks = ?
       WHERE id = ? AND branch_id = ?`,
      [
        payload.unitId,
        payload.agentId,
        payload.startDate,
        payload.endDate,
        payload.monthlyRent,
        payload.securityDeposit,
        payload.advanceRent,
        payload.type,
        payload.status,
        payload.remarks,
        id,
        branchId,
      ],
    );

    if (result.affectedRows > 0) {
      // ensure a single primary tenant row
      await conn.query('DELETE FROM contract_tenant WHERE contract_id = ? AND is_primary = 1', [id]);
      await conn.query(
        'INSERT INTO contract_tenant (contract_id, tenant_id, is_primary) VALUES (?, ?, 1)',
        [id, payload.tenantId],
      );

      // Keep unit inventory status in sync.
      // If the contract is active -> occupied, otherwise free it up (vacant).
      const isActive = String(payload.status).toLowerCase() === 'active';
      const unitStatus = isActive ? 'occupied' : 'vacant';
      await conn.query(
        `UPDATE unit u
         JOIN property pr ON pr.id = u.property_id
         SET u.status = ?
         WHERE u.id = ? AND pr.branch_id = ?`,
        [unitStatus, payload.unitId, branchId],
      );
    }

    await conn.commit();
    return result.affectedRows;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getContractById(id, branchId) {
  const [rows] = await pool.query(
    `SELECT
        c.id,
        c.branch_id,
        c.contract_no,
        c.unit_id,
        ct.tenant_id,
        c.agent_id,
        c.start_date,
        c.end_date,
        c.monthly_rent,
        c.security_deposit,
        c.advance_rent,
        c.contract_type,
        c.status,
        c.special_remarks AS remarks
     FROM lease_contract c
     LEFT JOIN contract_tenant ct
       ON ct.contract_id = c.id AND ct.is_primary = 1
     WHERE c.id = ? AND c.branch_id = ?
     LIMIT 1`,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteContractById(id, branchId) {
  const [result] = await pool.query('DELETE FROM lease_contract WHERE id = ? AND branch_id = ?', [
    id,
    branchId,
  ]);
  return result.affectedRows;
}
