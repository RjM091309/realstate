import { pool } from '../config/db.js';

const LANDLORD_SELECT = `
  l.id,
  l.branch_id,
  l.full_name,
  l.first_name,
  l.middle_name,
  l.last_name,
  l.company_name,
  l.mobile_no,
  l.email,
  l.birth_date,
  l.address,
  l.city,
  l.province,
  l.postal_code,
  l.gov_id_no,
  l.id_type,
  l.id_number,
  l.id_front_url,
  l.id_back_url,
  l.tin,
  l.proof_of_address_url,
  l.bank_name,
  l.account_name,
  l.account_number,
  l.gcash,
  l.maya,
  l.internal_notes,
  l.kyc_status,
  l.account_status,
  l.assigned_agent_id,
  l.last_activity_at,
  l.active,
  l.created_at,
  l.updated_at,
  CONCAT(agent.FIRSTNAME, ' ', agent.LASTNAME) AS assigned_agent_name
`;

const LANDLORD_AGG = `
  COALESCE(prop_stats.property_count, 0) AS property_count,
  COALESCE(prop_stats.total_units, 0) AS total_units,
  COALESCE(prop_stats.monthly_income, 0) AS monthly_rental_income,
  COALESCE(activity.last_activity, l.last_activity_at, l.updated_at, l.created_at) AS last_activity
`;

const LANDLORD_FROM = `
  FROM landlord_profile l
  LEFT JOIN user_info agent ON agent.IDNO = l.assigned_agent_id
  LEFT JOIN (
    SELECT
      p.landlord_id,
      COUNT(DISTINCT p.id) AS property_count,
      COUNT(DISTINCT u.id) AS total_units,
      COALESCE(SUM(CASE WHEN u.status = 'occupied' THEN u.monthly_rent ELSE 0 END), 0) AS monthly_income
    FROM property p
    LEFT JOIN unit u ON u.property_id = p.id AND u.active = 1
    WHERE p.active = 1 AND p.landlord_id IS NOT NULL
    GROUP BY p.landlord_id
  ) prop_stats ON prop_stats.landlord_id = l.id
  LEFT JOIN (
    SELECT record_id AS landlord_id, MAX(created_at) AS last_activity
    FROM audit_log
    WHERE record_table = 'landlord_profile'
    GROUP BY record_id
  ) activity ON activity.landlord_id = l.id
`;

export async function listLandlordsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      ${LANDLORD_SELECT},
      ${LANDLORD_AGG}
    ${LANDLORD_FROM}
    WHERE (l.branch_id = ? OR l.branch_id IS NULL)
      AND l.active = 1
    ORDER BY l.created_at DESC, l.id DESC
    `,
    [branchId],
  );
  return rows;
}

export async function getLandlordById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      ${LANDLORD_SELECT},
      ${LANDLORD_AGG}
    ${LANDLORD_FROM}
    WHERE l.id = ?
      AND (l.branch_id = ? OR l.branch_id IS NULL)
      AND l.active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function insertLandlord(branchId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO landlord_profile (
      branch_id,
      full_name,
      first_name,
      middle_name,
      last_name,
      company_name,
      mobile_no,
      email,
      birth_date,
      address,
      city,
      province,
      postal_code,
      gov_id_no,
      id_type,
      id_number,
      id_front_url,
      id_back_url,
      tin,
      proof_of_address_url,
      bank_name,
      account_name,
      account_number,
      gcash,
      maya,
      internal_notes,
      kyc_status,
      account_status,
      assigned_agent_id,
      last_activity_at,
      active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 1)
    `,
    [
      branchId,
      payload.fullName,
      payload.firstName ?? null,
      payload.middleName ?? null,
      payload.lastName ?? null,
      payload.companyName ?? null,
      payload.mobileNo ?? null,
      payload.email ?? null,
      payload.birthDate ?? null,
      payload.address ?? null,
      payload.city ?? null,
      payload.province ?? null,
      payload.postalCode ?? null,
      payload.govIdNo ?? payload.idNumber ?? null,
      payload.idType ?? null,
      payload.idNumber ?? payload.govIdNo ?? null,
      payload.idFrontUrl ?? null,
      payload.idBackUrl ?? null,
      payload.tin ?? null,
      payload.proofOfAddressUrl ?? null,
      payload.bankName ?? null,
      payload.accountName ?? null,
      payload.accountNumber ?? null,
      payload.gcash ?? null,
      payload.maya ?? null,
      payload.internalNotes ?? null,
      payload.kycStatus ?? 'pending',
      payload.accountStatus ?? 'active',
      payload.assignedAgentId ?? null,
    ],
  );
  return result.insertId;
}

export async function updateLandlordById(id, branchId, payload) {
  const [result] = await pool.query(
    `
    UPDATE landlord_profile
    SET
      full_name = ?,
      first_name = ?,
      middle_name = ?,
      last_name = ?,
      company_name = ?,
      mobile_no = ?,
      email = ?,
      birth_date = ?,
      address = ?,
      city = ?,
      province = ?,
      postal_code = ?,
      gov_id_no = ?,
      id_type = ?,
      id_number = ?,
      id_front_url = ?,
      id_back_url = ?,
      tin = ?,
      proof_of_address_url = ?,
      bank_name = ?,
      account_name = ?,
      account_number = ?,
      gcash = ?,
      maya = ?,
      internal_notes = ?,
      kyc_status = ?,
      account_status = ?,
      assigned_agent_id = ?,
      last_activity_at = NOW(),
      updated_at = NOW()
    WHERE id = ?
      AND (branch_id = ? OR branch_id IS NULL)
      AND active = 1
    `,
    [
      payload.fullName,
      payload.firstName ?? null,
      payload.middleName ?? null,
      payload.lastName ?? null,
      payload.companyName ?? null,
      payload.mobileNo ?? null,
      payload.email ?? null,
      payload.birthDate ?? null,
      payload.address ?? null,
      payload.city ?? null,
      payload.province ?? null,
      payload.postalCode ?? null,
      payload.govIdNo ?? payload.idNumber ?? null,
      payload.idType ?? null,
      payload.idNumber ?? payload.govIdNo ?? null,
      payload.idFrontUrl ?? null,
      payload.idBackUrl ?? null,
      payload.tin ?? null,
      payload.proofOfAddressUrl ?? null,
      payload.bankName ?? null,
      payload.accountName ?? null,
      payload.accountNumber ?? null,
      payload.gcash ?? null,
      payload.maya ?? null,
      payload.internalNotes ?? null,
      payload.kycStatus ?? 'pending',
      payload.accountStatus ?? 'active',
      payload.assignedAgentId ?? null,
      id,
      branchId,
    ],
  );
  return result.affectedRows;
}

export async function deactivateLandlordById(id, branchId) {
  const [result] = await pool.query(
    `
    UPDATE landlord_profile
    SET active = 0, account_status = 'inactive', updated_at = NOW()
    WHERE id = ?
      AND (branch_id = ? OR branch_id IS NULL)
      AND active = 1
    `,
    [id, branchId],
  );
  return result.affectedRows;
}

export async function listLandlordProperties(landlordId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.property_type,
      p.common_address,
      COUNT(DISTINCT u.id) AS units,
      SUM(CASE WHEN u.status = 'occupied' THEN 1 ELSE 0 END) AS occupied,
      SUM(CASE WHEN u.status = 'vacant' THEN 1 ELSE 0 END) AS vacant,
      COALESCE(SUM(CASE WHEN u.status = 'occupied' THEN u.monthly_rent ELSE 0 END), 0) AS monthly_income,
      p.active
    FROM property p
    LEFT JOIN unit u ON u.property_id = p.id AND u.active = 1
    WHERE p.landlord_id = ?
      AND (p.branch_id = ? OR p.branch_id IS NULL)
      AND p.active = 1
    GROUP BY p.id, p.name, p.property_type, p.common_address, p.active
    ORDER BY p.name ASC
    `,
    [landlordId, branchId],
  );
  return rows;
}

export async function listLandlordContracts(landlordId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      lc.id,
      lc.contract_no,
      lc.start_date,
      lc.end_date,
      lc.monthly_rent,
      lc.status,
      lc.created_at,
      u.unit_no,
      p.name AS property_name
    FROM lease_contract lc
    JOIN unit u ON u.id = lc.unit_id
    JOIN property p ON p.id = u.property_id
    WHERE lc.branch_id = ?
      AND lc.active = 1
      AND (lc.landlord_id = ? OR p.landlord_id = ?)
    ORDER BY lc.created_at DESC
    `,
    [branchId, landlordId, landlordId],
  );
  return rows;
}

export async function listLandlordDocuments(landlordId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      d.id,
      d.document_type,
      d.title,
      d.file_path,
      d.created_at,
      CONCAT(u.FIRSTNAME, ' ', u.LASTNAME) AS uploaded_by_name
    FROM landlord_document d
    LEFT JOIN user_info u ON u.IDNO = d.uploaded_by
    WHERE d.landlord_id = ?
      AND d.branch_id = ?
    ORDER BY d.created_at DESC
    `,
    [landlordId, branchId],
  );
  return rows;
}

export async function insertLandlordDocument(branchId, landlordId, payload) {
  const [result] = await pool.query(
    `
    INSERT INTO landlord_document (
      branch_id,
      landlord_id,
      document_type,
      title,
      file_path,
      uploaded_by
    ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      branchId,
      landlordId,
      payload.documentType,
      payload.title,
      payload.filePath,
      payload.uploadedBy ?? null,
    ],
  );
  return result.insertId;
}

export async function listLandlordTransactions(landlordId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      pt.id,
      pt.amount_paid,
      pt.payment_date,
      pt.payment_method,
      pt.reference_no,
      pt.created_at,
      lc.contract_no,
      p.name AS property_name,
      u.unit_no
    FROM payment_transaction pt
    JOIN payment_schedule ps ON ps.id = pt.payment_schedule_id AND ps.active = 1
    JOIN lease_contract lc ON lc.id = ps.contract_id AND lc.active = 1
    JOIN unit u ON u.id = lc.unit_id
    JOIN property p ON p.id = u.property_id
    WHERE pt.branch_id = ?
      AND pt.active = 1
      AND (lc.landlord_id = ? OR p.landlord_id = ?)
    ORDER BY pt.payment_date DESC, pt.id DESC
    LIMIT 100
    `,
    [branchId, landlordId, landlordId],
  );
  return rows;
}

export async function touchLandlordActivity(id, branchId) {
  await pool.query(
    `
    UPDATE landlord_profile
    SET last_activity_at = NOW(), updated_at = NOW()
    WHERE id = ? AND (branch_id = ? OR branch_id IS NULL) AND active = 1
    `,
    [id, branchId],
  );
}
