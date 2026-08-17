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

const LISTING_TYPES = new Set(['monthly_rental', 'selling', 'short_term_rental', 'pre_selling']);
const DEFAULT_LISTING_TYPE = 'monthly_rental';

function mapToListingType(listingType) {
  return LISTING_TYPES.has(listingType) ? listingType : DEFAULT_LISTING_TYPE;
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
      u.parking_slot AS parking_slot,
      u.furnishing AS furnishing,
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
      COALESCE(u.photos_json, '[]') AS photos_json,
      COALESCE(u.inventory_json, '[]') AS inventory_json,
      u.more_details AS more_details,
      u.special_remarks AS special_remarks,
      u.listing_type AS listing_type,
      u.market_value AS market_value,
      u.developer AS developer,
      u.listing_description AS listing_description,
      u.lot_area_sqm AS lot_area_sqm,
      u.floors_label AS floors_label,
      COALESCE(u.amenities_json, '[]') AS amenities_json,
      COALESCE(u.features_json, '[]') AS features_json,
      u.featured AS featured,
      u.is_new_listing AS is_new_listing
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

async function upsertAreaAndGetId(branchId, areaName, brgyName = null) {
  try {
    const { resolveAreaIds } = await import('../locations/locationsModel.js');
    const resolved = await resolveAreaIds(branchId, areaName, brgyName);
    if (resolved?.areaId) return resolved.areaId;
  } catch (e) {
    console.warn('[unitsModel] resolveAreaIds fallback:', e?.message ?? e);
  }

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
  if (rows[0]?.id) {
    await pool.query(`UPDATE property SET active = 1 WHERE id = ? AND active = 0`, [rows[0].id]);
    return rows[0].id;
  }

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
  const areaId = await upsertAreaAndGetId(branchId, payload.area, payload.buildingName);
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
      parking_slot,
      furnishing,
      unit_type,
      area_sqm,
      bedrooms,
      bathrooms,
      listing_type,
      monthly_rent,
      market_value,
      developer,
      listing_description,
      lot_area_sqm,
      floors_label,
      amenities_json,
      features_json,
      featured,
      is_new_listing,
      photo_data,
      photos_json,
      status,
      inventory_json,
      more_details,
      special_remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      propertyId,
      payload.unitNumber,
      payload.unitNumber,
      payload.floor,
      payload.tower,
      payload.parkingSlot ?? null,
      payload.furnishing ?? null,
      payload.unitType,
      payload.areaSqm ?? null,
      payload.bedrooms ?? null,
      payload.bathrooms ?? null,
      mapToListingType(payload.listingType),
      payload.monthlyRate,
      payload.marketValue ?? null,
      payload.developer ?? null,
      payload.listingDescription ?? null,
      payload.lotAreaSqm ?? null,
      payload.floorsLabel ?? null,
      payload.amenitiesJson ?? '[]',
      payload.featuresJson ?? '[]',
      payload.featured ? 1 : 0,
      payload.isNewListing ? 1 : 0,
      payload.photoDataUrl ?? null,
      payload.photosJson ?? '[]',
      mapToUnitStatus(payload.status),
      payload.inventoryJson,
      payload.moreDetails ?? null,
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

  const areaId = await upsertAreaAndGetId(branchId, payload.area, payload.buildingName);
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
      parking_slot = ?,
      furnishing = ?,
      unit_type = ?,
      area_sqm = ?,
      bedrooms = ?,
      bathrooms = ?,
      listing_type = ?,
      monthly_rent = ?,
      market_value = ?,
      developer = ?,
      listing_description = ?,
      lot_area_sqm = ?,
      floors_label = ?,
      amenities_json = ?,
      features_json = ?,
      featured = ?,
      is_new_listing = ?,
      photo_data = ?,
      photos_json = ?,
      status = ?,
      inventory_json = ?,
      more_details = ?,
      special_remarks = ?
    WHERE id = ? AND active = 1
    `,
    [
      propertyId,
      payload.unitNumber,
      payload.unitNumber,
      payload.floor,
      payload.tower,
      payload.parkingSlot ?? null,
      payload.furnishing ?? null,
      payload.unitType,
      payload.areaSqm ?? null,
      payload.bedrooms ?? null,
      payload.bathrooms ?? null,
      mapToListingType(payload.listingType),
      payload.monthlyRate,
      payload.marketValue ?? null,
      payload.developer ?? null,
      payload.listingDescription ?? null,
      payload.lotAreaSqm ?? null,
      payload.floorsLabel ?? null,
      payload.amenitiesJson ?? '[]',
      payload.featuresJson ?? '[]',
      payload.featured ? 1 : 0,
      payload.isNewListing ? 1 : 0,
      payload.photoDataUrl ?? null,
      payload.photosJson ?? '[]',
      mapToUnitStatus(payload.status),
      payload.inventoryJson,
      payload.moreDetails ?? null,
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
      u.parking_slot AS parking_slot,
      u.furnishing AS furnishing,
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
      COALESCE(u.photos_json, '[]') AS photos_json,
      COALESCE(u.inventory_json, '[]') AS inventory_json,
      u.more_details AS more_details,
      u.special_remarks AS special_remarks,
      u.listing_type AS listing_type,
      u.market_value AS market_value,
      u.developer AS developer,
      u.listing_description AS listing_description,
      u.lot_area_sqm AS lot_area_sqm,
      u.floors_label AS floors_label,
      COALESCE(u.amenities_json, '[]') AS amenities_json,
      COALESCE(u.features_json, '[]') AS features_json,
      u.featured AS featured,
      u.is_new_listing AS is_new_listing
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

/** Soft-deleted barangay/building panel rows (seed lists stay hidden after delete). */
export async function listDeletedBuildings(branchId) {
  const [rows] = await pool.query(
    `
    SELECT location_name, building_name
    FROM deleted_building
    WHERE branch_id = ? AND active = 1
    ORDER BY location_name ASC, building_name ASC
    `,
    [branchId],
  );
  return rows;
}

/**
 * Soft-delete a building/barangay under a city/area:
 * - units → active=0
 * - matching property rows → active=0
 * - record in deleted_building so seeded lists stay hidden
 */
export async function softDeleteBuilding(branchId, locationName, buildingName) {
  const location = String(locationName ?? '').trim();
  const building = String(buildingName ?? '').trim();
  if (!location || !building) return { units: 0, properties: 0 };

  const [unitResult] = await pool.query(
    `
    UPDATE unit u
    JOIN property pr ON pr.id = u.property_id
    JOIN area a ON a.id = pr.area_id
    SET
      u.active = 0,
      u.status = 'inactive'
    WHERE pr.branch_id = ?
      AND u.active = 1
      AND LOWER(TRIM(a.name)) = LOWER(?)
      AND LOWER(TRIM(pr.name)) = LOWER(?)
    `,
    [branchId, location, building],
  );

  const [propertyResult] = await pool.query(
    `
    UPDATE property pr
    JOIN area a ON a.id = pr.area_id
    SET pr.active = 0
    WHERE pr.branch_id = ?
      AND pr.active = 1
      AND LOWER(TRIM(a.name)) = LOWER(?)
      AND LOWER(TRIM(pr.name)) = LOWER(?)
    `,
    [branchId, location, building],
  );

  await pool.query(
    `
    INSERT INTO deleted_building (branch_id, location_name, building_name, active, deleted_at)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      active = 1,
      deleted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    `,
    [branchId, location, building],
  );

  return {
    units: Number(unitResult.affectedRows ?? 0),
    properties: Number(propertyResult.affectedRows ?? 0),
  };
}

/** Clear soft-delete so a barangay/building can show again (e.g. re-added via +). */
export async function restoreDeletedBuilding(branchId, locationName, buildingName) {
  const location = String(locationName ?? '').trim();
  const building = String(buildingName ?? '').trim();
  if (!location || !building) return 0;

  const [result] = await pool.query(
    `
    UPDATE deleted_building
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ?
      AND LOWER(TRIM(location_name)) = LOWER(?)
      AND LOWER(TRIM(building_name)) = LOWER(?)
      AND active = 1
    `,
    [branchId, location, building],
  );
  return Number(result.affectedRows ?? 0);
}

/**
 * Public marketing site feed: active units that are currently Available or
 * Reserved, across all branches. No auth — never include tenant/contract/
 * financial data here, only unit/listing fields meant to be public.
 */
export async function listPublicUnitListings() {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.unit_no AS unit_number,
      pr.name AS building_name,
      pr.common_address AS common_address,
      pr.legal_address AS legal_address,
      a.name AS area,
      u.unit_type AS unit_type,
      CASE u.status
        WHEN 'vacant' THEN 'Available'
        WHEN 'reserved' THEN 'Reserved'
        ELSE u.status
      END AS status,
      u.area_sqm AS area_sqm,
      u.bedrooms AS bedrooms,
      u.bathrooms AS bathrooms,
      u.parking_slot AS parking_slot,
      u.floors_label AS floors_label,
      u.listing_type AS listing_type,
      u.monthly_rent AS monthly_rate,
      u.market_value AS market_value,
      u.developer AS developer,
      u.listing_description AS listing_description,
      u.lot_area_sqm AS lot_area_sqm,
      COALESCE(u.amenities_json, '[]') AS amenities_json,
      COALESCE(u.features_json, '[]') AS features_json,
      u.featured AS featured,
      u.is_new_listing AS is_new_listing,
      u.photo_data AS photo_data,
      COALESCE(u.photos_json, '[]') AS photos_json,
      u.more_details AS more_details,
      u.special_remarks AS special_remarks
    FROM unit u
    JOIN property pr ON pr.id = u.property_id
    JOIN area a ON a.id = pr.area_id
    WHERE u.active = 1 AND u.status IN ('vacant', 'reserved')
    ORDER BY u.featured DESC, u.id DESC
    `,
  );
  return rows;
}
