import { pool } from '../config/db.js';
import { LOCATION_BUILDING_SEEDS } from './seedData.js';

export async function listLocationBuildings(branchId, { location = null, includeInactive = false } = {}) {
  const params = [branchId];
  let sql = `
    SELECT id, location_name, building_name, active, created_at, updated_at
    FROM location_building
    WHERE branch_id = ?
  `;
  if (!includeInactive) {
    sql += ` AND active = 1`;
  }
  if (location) {
    sql += ` AND LOWER(TRIM(location_name)) = LOWER(?)`;
    params.push(String(location).trim());
  }
  sql += ` ORDER BY location_name ASC, building_name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getLocationBuildingById(id, branchId) {
  const [rows] = await pool.query(
    `
    SELECT id, location_name, building_name, active, created_at, updated_at
    FROM location_building
    WHERE id = ? AND branch_id = ?
    LIMIT 1
    `,
    [id, branchId],
  );
  return rows[0] ?? null;
}

export async function findLocationBuilding(branchId, locationName, buildingName) {
  const [rows] = await pool.query(
    `
    SELECT id, location_name, building_name, active
    FROM location_building
    WHERE branch_id = ?
      AND LOWER(TRIM(location_name)) = LOWER(?)
      AND LOWER(TRIM(building_name)) = LOWER(?)
    LIMIT 1
    `,
    [branchId, String(locationName).trim(), String(buildingName).trim()],
  );
  return rows[0] ?? null;
}

/** Create or reactivate (soft-restore) a managed barangay/building. */
export async function upsertLocationBuilding(branchId, locationName, buildingName) {
  const location = String(locationName ?? '').trim();
  const building = String(buildingName ?? '').trim();
  if (!location || !building) return null;

  await pool.query(
    `
    INSERT INTO location_building (branch_id, location_name, building_name, active)
    VALUES (?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      active = 1,
      location_name = VALUES(location_name),
      building_name = VALUES(building_name),
      updated_at = CURRENT_TIMESTAMP
    `,
    [branchId, location, building],
  );

  return findLocationBuilding(branchId, location, building);
}

export async function renameLocationBuilding(id, branchId, nextBuildingName) {
  const building = String(nextBuildingName ?? '').trim();
  if (!building) return 0;

  const existing = await getLocationBuildingById(id, branchId);
  if (!existing) return 0;

  const clash = await findLocationBuilding(branchId, existing.location_name, building);
  if (clash && String(clash.id) !== String(id)) {
    const err = new Error('BUILDING_EXISTS');
    throw err;
  }

  const [result] = await pool.query(
    `
    UPDATE location_building
    SET building_name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND branch_id = ? AND active = 1
    `,
    [building, id, branchId],
  );
  return Number(result.affectedRows ?? 0);
}

/**
 * Soft-delete managed building + related units/properties.
 * Rows stay in `location_building` with active=0.
 */
export async function softDeleteLocationBuilding(branchId, locationName, buildingName) {
  const location = String(locationName ?? '').trim();
  const building = String(buildingName ?? '').trim();
  if (!location || !building) return { units: 0, properties: 0, buildings: 0 };

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

  const [buildingResult] = await pool.query(
    `
    UPDATE location_building
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE branch_id = ?
      AND LOWER(TRIM(location_name)) = LOWER(?)
      AND LOWER(TRIM(building_name)) = LOWER(?)
      AND active = 1
    `,
    [branchId, location, building],
  );

  // Ensure a soft-deleted row exists even if it was never seeded/added before.
  if (Number(buildingResult.affectedRows ?? 0) === 0) {
    await pool.query(
      `
      INSERT INTO location_building (branch_id, location_name, building_name, active)
      VALUES (?, ?, ?, 0)
      ON DUPLICATE KEY UPDATE
        active = 0,
        updated_at = CURRENT_TIMESTAMP
      `,
      [branchId, location, building],
    );
  }

  return {
    units: Number(unitResult.affectedRows ?? 0),
    properties: Number(propertyResult.affectedRows ?? 0),
    buildings: Math.max(1, Number(buildingResult.affectedRows ?? 0)),
  };
}

export async function softDeleteLocationBuildingById(id, branchId) {
  const row = await getLocationBuildingById(id, branchId);
  if (!row) return null;
  return softDeleteLocationBuilding(branchId, row.location_name, row.building_name);
}

/** Seed defaults for every branch; never reactivates soft-deleted rows. */
export async function seedLocationBuildingsForAllBranches() {
  const [branches] = await pool.query(`SELECT id FROM branch`);
  for (const branch of branches) {
    const branchId = branch.id;
    // Once a branch already has rows, do not re-inject canonical seed location
    // names — that recreated "Angeles City" after the user renamed the city.
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM location_building WHERE branch_id = ?`,
      [branchId],
    );
    if (Number(countRows[0]?.cnt ?? 0) > 0) continue;

    for (const city of LOCATION_BUILDING_SEEDS) {
      for (const building of city.buildings) {
        await pool.query(
          `
          INSERT IGNORE INTO location_building (branch_id, location_name, building_name, active)
          VALUES (?, ?, ?, 1)
          `,
          [branchId, city.location, building],
        );
      }
    }
  }
}

/** One-time copy of legacy deleted_building hides into location_building.active=0. */
export async function migrateDeletedBuildingIntoLocationBuilding() {
  const [tables] = await pool.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'deleted_building'
    `,
  );
  if (!tables.length) return;

  await pool.query(
    `
    INSERT INTO location_building (branch_id, location_name, building_name, active)
    SELECT db.branch_id, db.location_name, db.building_name, 0
    FROM deleted_building db
    WHERE db.active = 1
    ON DUPLICATE KEY UPDATE
      active = 0,
      updated_at = CURRENT_TIMESTAMP
    `,
  );
}
