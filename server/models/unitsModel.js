import { pool } from '../config/db.js';

const STATUS_MAP_TO_UNIT = {
  Available: 'vacant',
  Occupied: 'occupied',
  Maintenance: 'maintenance',
  Reserved: 'reserved',
};

const DEFAULT_UNIT_STATUS = 'vacant';

function mapToUnitStatus(status) {
  return STATUS_MAP_TO_UNIT[status] ?? DEFAULT_UNIT_STATUS;
}

export async function listUnitsByBranch(branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      pr.branch_id AS branch_id,
      u.unit_no AS unit_number,
      u.floor_no AS floor,
      u.tower AS tower,
      pr.name AS building_name,
      pr.common_address AS common_address,
      pr.legal_address AS legal_address,
      u.unit_type AS unit_type,
      u.area_sqm AS area_sqm,
      u.bedrooms AS bedrooms,
      u.bathrooms AS bathrooms,
      CASE u.status
        WHEN 'vacant' THEN 'Available'
        WHEN 'occupied' THEN 'Occupied'
        WHEN 'maintenance' THEN 'Maintenance'
        WHEN 'reserved' THEN 'Reserved'
        ELSE u.status
      END AS status,
      a.name AS area,
      u.monthly_rent AS monthly_rate,
      u.photo_data AS photo_data,
      COALESCE(u.inventory_json, '[]') AS inventory_json,
      u.special_remarks AS special_remarks
    FROM unit u
    JOIN property pr ON pr.id = u.property_id
    JOIN area a ON a.id = pr.area_id
    WHERE pr.branch_id = ? AND u.active = 1
    ORDER BY pr.name ASC, u.unit_no ASC
    `,
    [branchId],
  );
  return rows;
}

async function upsertAreaAndGetId(branchId, areaName) {
  await pool.query(
    `INSERT INTO area (branch_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)`,
    [branchId, areaName],
  );

  const [rows] = await pool.query(`SELECT id FROM area WHERE branch_id = ? AND name = ? LIMIT 1`, [
    branchId,
    areaName,
  ]);
  return rows[0]?.id ?? null;
}

async function upsertPropertyAndGetId(branchId, areaId, payload) {
  const [rows] = await pool.query(
    `
    SELECT id
    FROM property
    WHERE branch_id = ? AND area_id = ? AND name = ? AND common_address = ? AND legal_address = ?
    LIMIT 1
    `,
    [branchId, areaId, payload.buildingName, payload.commonAddress, payload.legalAddress],
  );
  if (rows[0]?.id) return rows[0].id;

  const [ins] = await pool.query(
    `
    INSERT INTO property (branch_id, area_id, name, common_address, legal_address, property_type, active)
    VALUES (?, ?, ?, ?, ?, 'condo', 1)
    `,
    [branchId, areaId, payload.buildingName, payload.commonAddress, payload.legalAddress],
  );
  // MySQL: insertId is returned in the result object
  return ins.insertId;
}

export async function insertUnit(branchId, payload) {
  const areaId = await upsertAreaAndGetId(branchId, payload.area);
  if (!areaId) throw new Error('Failed to resolve area_id');

  const propertyId = await upsertPropertyAndGetId(branchId, areaId, payload);
  if (!propertyId) throw new Error('Failed to resolve property_id');

  const [res] = await pool.query(
    `
    INSERT INTO unit (
      property_id,
      unit_code,
      unit_no,
      floor_no,
      tower,
      unit_type,
      area_sqm,
      bedrooms,
      bathrooms,
      listing_type,
      monthly_rent,
      photo_data,
      status,
      inventory_json,
      special_remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'monthly_rental', ?, ?, ?, ?, ?)
    `,
    [
      propertyId,
      payload.unitNumber,
      payload.unitNumber,
      payload.floor,
      payload.tower,
      payload.unitType,
      payload.areaSqm ?? null,
      payload.bedrooms ?? null,
      payload.bathrooms ?? null,
      payload.monthlyRate,
      payload.photoDataUrl ?? null,
      mapToUnitStatus(payload.status),
      payload.inventoryJson,
      payload.specialRemarks ?? null,
    ],
  );

  return getUnitById(res.insertId, branchId);
}

export async function updateUnitById(id, branchId, payload) {
  // Ensure the unit belongs to the branch (avoid cross-branch updates).
  const [existingRows] = await pool.query(
    `
    SELECT u.id
    FROM unit u
    JOIN property pr ON pr.id = u.property_id
    WHERE u.id = ? AND pr.branch_id = ? AND u.active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  if (!existingRows[0]?.id) return 0;

  const areaId = await upsertAreaAndGetId(branchId, payload.area);
  const propertyId = await upsertPropertyAndGetId(branchId, areaId, payload);

  const [result] = await pool.query(
    `
    UPDATE unit
    SET
      property_id = ?,
      unit_code = ?,
      unit_no = ?,
      floor_no = ?,
      tower = ?,
      unit_type = ?,
      area_sqm = ?,
      bedrooms = ?,
      bathrooms = ?,
      monthly_rent = ?,
      photo_data = ?,
      status = ?,
      inventory_json = ?,
      special_remarks = ?
    WHERE id = ? AND active = 1
    `,
    [
      propertyId,
      payload.unitNumber,
      payload.unitNumber,
      payload.floor,
      payload.tower,
      payload.unitType,
      payload.areaSqm ?? null,
      payload.bedrooms ?? null,
      payload.bathrooms ?? null,
      payload.monthlyRate,
      payload.photoDataUrl ?? null,
      mapToUnitStatus(payload.status),
      payload.inventoryJson,
      payload.specialRemarks ?? null,
      id,
    ],
  );
  return result.affectedRows;
}

export async function getUnitById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      pr.branch_id AS branch_id,
      u.unit_no AS unit_number,
      u.floor_no AS floor,
      u.tower AS tower,
      pr.name AS building_name,
      pr.common_address AS common_address,
      pr.legal_address AS legal_address,
      u.unit_type AS unit_type,
      u.area_sqm AS area_sqm,
      u.bedrooms AS bedrooms,
      u.bathrooms AS bathrooms,
      CASE u.status
        WHEN 'vacant' THEN 'Available'
        WHEN 'occupied' THEN 'Occupied'
        WHEN 'maintenance' THEN 'Maintenance'
        WHEN 'reserved' THEN 'Reserved'
        ELSE u.status
      END AS status,
      a.name AS area,
      u.monthly_rent AS monthly_rate,
      u.photo_data AS photo_data,
      COALESCE(u.inventory_json, '[]') AS inventory_json,
      u.special_remarks AS special_remarks
    FROM unit u
    JOIN property pr ON pr.id = u.property_id
    JOIN area a ON a.id = pr.area_id
    WHERE u.id = ? AND pr.branch_id = ? AND u.active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function deleteUnitById(id, branchId) {
  const [result] = await pool.query(
    `
    UPDATE unit u
    JOIN property pr ON pr.id = u.property_id
    SET
      u.active = 0,
      u.status = 'inactive'
    WHERE u.id = ? AND pr.branch_id = ? AND u.active = 1
    `,
    [id, branchId],
  );
  return result.affectedRows;
}

export async function updateUnitStatusById(id, branchId, status) {
  const [existingRows] = await pool.query(
    `
    SELECT u.id
    FROM unit u
    JOIN property pr ON pr.id = u.property_id
    WHERE u.id = ? AND pr.branch_id = ? AND u.active = 1
    LIMIT 1
    `,
    [id, branchId],
  );
  if (!existingRows[0]?.id) return 0;
  const [result] = await pool.query(`UPDATE unit SET status = ? WHERE id = ? AND active = 1`, [
    mapToUnitStatus(status),
    id,
  ]);
  return result.affectedRows;
}
