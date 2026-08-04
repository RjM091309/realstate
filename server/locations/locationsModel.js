import { pool } from '../config/db.js';
import { CITY_BRGY_SEEDS } from './seedData.js';

/** Trim/collapse whitespace only — keep leading numbers like "1. Angeles City". */
function cleanName(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alias key helper — strips ordinals for duplicate/merge matching only. */
function aliasName(value) {
  return String(value ?? '')
    .trim()
    .replace(/^#?\d+[.)\]:\-]\s*/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when display name already has a list ordinal ("1. Clark"). */
function hasOrdinalPrefix(value) {
  return /^#?\d+[.)\]:\-]\s+\S/u.test(String(value ?? '').trim());
}

/** Prefer numbered city rows; then lower city_id as stable tie-break. */
function preferCityRow(a, b) {
  const aOrd = hasOrdinalPrefix(a?.name);
  const bOrd = hasOrdinalPrefix(b?.name);
  if (aOrd && !bOrd) return a;
  if (bOrd && !aOrd) return b;
  return Number(a?.city_id) <= Number(b?.city_id) ? a : b;
}

async function nextCityOrdinal(branchId) {
  const cities = await listCities(branchId, { includeInactive: false });
  let max = 0;
  for (const row of cities) {
    const m = String(row.name ?? '')
      .trim()
      .match(/^#?(\d+)[.)\]:\-]\s+/u);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return max + 1;
}

/** Ensure CITY category names always use "N. Name" format. */
async function withCityOrdinalPrefix(branchId, name) {
  const cleaned = cleanName(name);
  if (!cleaned) return cleaned;
  if (hasOrdinalPrefix(cleaned)) return cleaned;
  const n = await nextCityOrdinal(branchId);
  return `${n}. ${aliasName(cleaned) || cleaned}`;
}

async function reassignCityChildren(keepCityId, dropCityId, branchId) {
  await pool.query(
    `
    UPDATE brgy b
    LEFT JOIN brgy keep_b
      ON keep_b.city_id = ?
     AND LOWER(TRIM(keep_b.name)) = LOWER(TRIM(b.name))
    SET b.city_id = ?, b.updated_at = CURRENT_TIMESTAMP
    WHERE b.city_id = ? AND keep_b.brgy_id IS NULL
    `,
    [keepCityId, keepCityId, dropCityId],
  );
  await pool.query(
    `
    UPDATE brgy
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE city_id = ? AND active = 1
    `,
    [dropCityId],
  );
  await pool.query(
    `
    UPDATE area
    SET city_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE city_id = ? AND branch_id = ?
    `,
    [keepCityId, dropCityId, branchId],
  );
}

/* ───────────────────────── City ───────────────────────── */

export async function listCities(branchId, { includeInactive = false } = {}) {
  const params = [branchId];
  let sql = `
    SELECT city_id, branch_id, name, active, created_at, updated_at
    FROM city
    WHERE branch_id = ?
  `;
  if (!includeInactive) sql += ` AND active = 1`;
  sql += ` ORDER BY name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getCityById(cityId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT city_id, branch_id, name, active, created_at, updated_at
    FROM city
    WHERE city_id = ? AND branch_id = ?
    LIMIT 1
    `,
    [cityId, branchId],
  );
  return rows[0] ?? null;
}

export async function findCityByName(branchId, name) {
  const cleaned = cleanName(name);
  if (!cleaned) return null;

  const [exactRows] = await pool.query(
    `
    SELECT city_id, branch_id, name, active, created_at, updated_at
    FROM city
    WHERE branch_id = ? AND LOWER(TRIM(name)) = LOWER(?)
    ORDER BY active DESC, city_id ASC
    LIMIT 1
    `,
    [branchId, cleaned],
  );
  const exact = exactRows[0] ?? null;
  if (exact && Number(exact.active) === 1) return exact;

  const alias = aliasName(cleaned).toLowerCase();
  if (!alias) return exact;

  const active = await listCities(branchId, { includeInactive: false });
  const matches = active.filter(
    (row) => aliasName(row.name).toLowerCase() === alias,
  );
  if (matches.length === 0) return exact;
  return matches.reduce(preferCityRow);
}

export async function upsertCity(branchId, name) {
  const cleaned = cleanName(name);
  if (!cleaned) return null;

  const existing = await findCityByName(branchId, cleaned);
  if (existing && Number(existing.active) === 1) {
    // Upgrade bare seed name → numbered category name when caller provides ordinal.
    if (hasOrdinalPrefix(cleaned) && !hasOrdinalPrefix(existing.name)) {
      try {
        await renameCity(existing.city_id, branchId, cleaned);
        return (await getCityById(existing.city_id, branchId)) || existing;
      } catch {
        return existing;
      }
    }
    return existing;
  }

  const toInsert = await withCityOrdinalPrefix(branchId, cleaned);

  await pool.query(
    `
    INSERT INTO city (branch_id, name, active)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE
      active = 1,
      updated_at = CURRENT_TIMESTAMP
    `,
    [branchId, toInsert],
  );
  return findCityByName(branchId, toInsert);
}

export async function renameCity(cityId, branchId, nextName) {
  let cleaned = cleanName(nextName);
  if (!cleaned) return 0;

  const existing = await getCityById(cityId, branchId);
  if (!existing || Number(existing.active) !== 1) return 0;

  // CITY category must stay numbered ("1. Name"). Keep current N when user drops it.
  if (!hasOrdinalPrefix(cleaned)) {
    const m = String(existing.name ?? '')
      .trim()
      .match(/^#?(\d+)[.)\]:\-]\s+/u);
    const base = aliasName(cleaned) || cleaned;
    cleaned = m ? `${Number(m[1])}. ${base}` : await withCityOrdinalPrefix(branchId, base);
  }

  const clashExact = await findCityByName(branchId, cleaned);
  if (clashExact && String(clashExact.city_id) !== String(cityId)) {
    // Alias clash (e.g. renaming to bare "Clark" while "1. Clark" exists).
    const err = new Error('CITY_EXISTS');
    throw err;
  }

  const oldName = String(existing.name ?? '').trim();
  if (oldName.toLowerCase() === cleaned.toLowerCase()) {
    // Still normalize casing if needed.
    if (oldName !== cleaned) {
      await pool.query(
        `
        UPDATE city
        SET name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE city_id = ? AND branch_id = ? AND active = 1
        `,
        [cleaned, cityId, branchId],
      );
    }
    return 1;
  }

  const [result] = await pool.query(
    `
    UPDATE city
    SET name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE city_id = ? AND branch_id = ? AND active = 1
    `,
    [cleaned, cityId, branchId],
  );
  const affected = Number(result.affectedRows ?? 0);
  if (affected === 0) return 0;

  // Sync related rows best-effort. Never roll back the city rename on area unique conflicts.
  try {
    // Prefer renaming the area row that mirrored the old city name (typical seed/unit area).
    const [namedAreas] = await pool.query(
      `
      SELECT id, name
      FROM area
      WHERE branch_id = ? AND city_id = ? AND LOWER(TRIM(name)) = LOWER(?)
      `,
      [branchId, cityId, oldName],
    );
    for (const area of namedAreas) {
      try {
        await pool.query(
          `
          UPDATE area
          SET name = ?, city = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [cleaned, cleaned, area.id],
        );
      } catch (areaErr) {
        // uk_area_branch_name clash: keep city rename; just refresh city label on this row.
        if (areaErr?.code === 'ER_DUP_ENTRY') {
          await pool.query(
            `
            UPDATE area
            SET city = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [cleaned, area.id],
          );
        } else {
          console.warn('[renameCity] area sync skipped:', areaErr?.message ?? areaErr);
        }
      }
    }

    // Other areas linked to this city: update city label only (do not force-rename area.name).
    await pool.query(
      `
      UPDATE area
      SET city = ?, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND city_id = ?
      `,
      [cleaned, branchId, cityId],
    );

    await pool.query(
      `
      UPDATE area
      SET city_id = COALESCE(city_id, ?), city = ?, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ?
        AND city_id IS NULL
        AND LOWER(TRIM(name)) = LOWER(?)
      `,
      [cityId, cleaned, branchId, oldName],
    );

    await pool.query(
      `
      UPDATE location_building
      SET location_name = ?, updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND LOWER(TRIM(location_name)) = LOWER(?)
      `,
      [cleaned, branchId, oldName],
    );
  } catch (syncErr) {
    console.warn('[renameCity] related sync skipped:', syncErr?.message ?? syncErr);
  }

  return affected;
}

export async function softDeleteCity(cityId, branchId) {
  const [result] = await pool.query(
    `
    UPDATE city
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE city_id = ? AND branch_id = ? AND active = 1
    `,
    [cityId, branchId],
  );
  if (Number(result.affectedRows ?? 0) > 0) {
    await pool.query(
      `
      UPDATE brgy
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE city_id = ? AND active = 1
      `,
      [cityId],
    );
    await pool.query(
      `
      UPDATE area
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE city_id = ? AND branch_id = ? AND active = 1
      `,
      [cityId, branchId],
    );
  }
  return Number(result.affectedRows ?? 0);
}

/* ───────────────────────── Brgy ───────────────────────── */

export async function listBrgys(branchId, { cityId = null, includeInactive = false } = {}) {
  const params = [branchId];
  let sql = `
    SELECT b.brgy_id, b.city_id, b.name, b.active, b.created_at, b.updated_at,
           c.name AS city_name
    FROM brgy b
    JOIN city c ON c.city_id = b.city_id
    WHERE c.branch_id = ?
  `;
  if (!includeInactive) sql += ` AND b.active = 1 AND c.active = 1`;
  if (cityId) {
    sql += ` AND b.city_id = ?`;
    params.push(cityId);
  }
  sql += ` ORDER BY c.name ASC, b.name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getBrgyById(brgyId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT b.brgy_id, b.city_id, b.name, b.active, b.created_at, b.updated_at,
           c.name AS city_name
    FROM brgy b
    JOIN city c ON c.city_id = b.city_id
    WHERE b.brgy_id = ? AND c.branch_id = ?
    LIMIT 1
    `,
    [brgyId, branchId],
  );
  return rows[0] ?? null;
}

export async function findBrgyByName(cityId, name) {
  const cleaned = cleanName(name);
  if (!cleaned || !cityId) return null;
  const [rows] = await pool.query(
    `
    SELECT brgy_id, city_id, name, active, created_at, updated_at
    FROM brgy
    WHERE city_id = ? AND LOWER(TRIM(name)) = LOWER(?)
    LIMIT 1
    `,
    [cityId, cleaned],
  );
  return rows[0] ?? null;
}

export async function upsertBrgy(cityId, name) {
  const cleaned = cleanName(name);
  if (!cleaned || !cityId) return null;

  await pool.query(
    `
    INSERT INTO brgy (city_id, name, active)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE
      active = 1,
      name = VALUES(name),
      updated_at = CURRENT_TIMESTAMP
    `,
    [cityId, cleaned],
  );
  return findBrgyByName(cityId, cleaned);
}

export async function renameBrgy(brgyId, branchId, nextName) {
  const cleaned = cleanName(nextName);
  if (!cleaned) return 0;

  const existing = await getBrgyById(brgyId, branchId);
  if (!existing || Number(existing.active) !== 1) return 0;

  const clash = await findBrgyByName(existing.city_id, cleaned);
  if (clash && String(clash.brgy_id) !== String(brgyId)) {
    const err = new Error('BRGY_EXISTS');
    throw err;
  }

  const oldName = String(existing.name ?? '').trim();
  const cityName = String(existing.city_name ?? '').trim();
  const [result] = await pool.query(
    `
    UPDATE brgy
    SET name = ?, updated_at = CURRENT_TIMESTAMP
    WHERE brgy_id = ? AND active = 1
    `,
    [cleaned, brgyId],
  );
  const affected = Number(result.affectedRows ?? 0);
  if (affected > 0 && oldName && oldName.toLowerCase() !== cleaned.toLowerCase()) {
    await pool.query(
      `
      UPDATE area
      SET updated_at = CURRENT_TIMESTAMP
      WHERE brgy_id = ? AND branch_id = ?
      `,
      [brgyId, branchId],
    );
    if (cityName) {
      await pool.query(
        `
        UPDATE location_building
        SET building_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE branch_id = ?
          AND LOWER(TRIM(location_name)) = LOWER(?)
          AND LOWER(TRIM(building_name)) = LOWER(?)
        `,
        [cleaned, branchId, cityName, oldName],
      );
      await pool.query(
        `
        UPDATE property pr
        JOIN area a ON a.id = pr.area_id
        SET pr.name = ?, pr.common_address = ?, pr.legal_address = ?, pr.updated_at = CURRENT_TIMESTAMP
        WHERE pr.branch_id = ?
          AND a.city_id = ?
          AND LOWER(TRIM(pr.name)) = LOWER(?)
        `,
        [cleaned, cleaned, cleaned, branchId, existing.city_id, oldName],
      );
    }
  }
  return affected;
}

export async function softDeleteBrgy(brgyId, branchId) {
  const existing = await getBrgyById(brgyId, branchId);
  if (!existing) return 0;

  const [result] = await pool.query(
    `
    UPDATE brgy
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE brgy_id = ? AND active = 1
    `,
    [brgyId],
  );
  if (Number(result.affectedRows ?? 0) > 0) {
    await pool.query(
      `
      UPDATE area
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE brgy_id = ? AND branch_id = ? AND active = 1
      `,
      [brgyId, branchId],
    );
    const cityName = String(existing.city_name ?? '').trim();
    const brgyName = String(existing.name ?? '').trim();
    if (cityName && brgyName) {
      await pool.query(
        `
        UPDATE location_building
        SET active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE branch_id = ?
          AND LOWER(TRIM(location_name)) = LOWER(?)
          AND LOWER(TRIM(building_name)) = LOWER(?)
        `,
        [branchId, cityName, brgyName],
      );
    }
  }
  return Number(result.affectedRows ?? 0);
}

/* ───────────────────────── Area ───────────────────────── */

export async function listAreas(
  branchId,
  { cityId = null, brgyId = null, includeInactive = false } = {},
) {
  const params = [branchId];
  let sql = `
    SELECT a.id, a.branch_id, a.name, a.city_id, a.brgy_id, a.city, a.district,
           a.active, a.created_at, a.updated_at,
           c.name AS city_name,
           b.name AS brgy_name
    FROM area a
    LEFT JOIN city c ON c.city_id = a.city_id
    LEFT JOIN brgy b ON b.brgy_id = a.brgy_id
    WHERE a.branch_id = ?
  `;
  if (!includeInactive) sql += ` AND a.active = 1`;
  if (cityId) {
    sql += ` AND a.city_id = ?`;
    params.push(cityId);
  }
  if (brgyId) {
    sql += ` AND a.brgy_id = ?`;
    params.push(brgyId);
  }
  sql += ` ORDER BY COALESCE(c.name, a.city, a.name) ASC, COALESCE(b.name, '') ASC, a.name ASC`;
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function getAreaById(areaId, branchId) {
  const [rows] = await pool.query(
    `
    SELECT a.id, a.branch_id, a.name, a.city_id, a.brgy_id, a.city, a.district,
           a.active, a.created_at, a.updated_at,
           c.name AS city_name,
           b.name AS brgy_name
    FROM area a
    LEFT JOIN city c ON c.city_id = a.city_id
    LEFT JOIN brgy b ON b.brgy_id = a.brgy_id
    WHERE a.id = ? AND a.branch_id = ?
    LIMIT 1
    `,
    [areaId, branchId],
  );
  return rows[0] ?? null;
}

export async function findAreaByName(branchId, name) {
  const cleaned = cleanName(name);
  if (!cleaned) return null;
  const [rows] = await pool.query(
    `
    SELECT id, branch_id, name, city_id, brgy_id, city, district, active
    FROM area
    WHERE branch_id = ? AND LOWER(TRIM(name)) = LOWER(?)
    LIMIT 1
    `,
    [branchId, cleaned],
  );
  return rows[0] ?? null;
}

/**
 * Upsert area row and attach city_id / brgy_id when provided.
 * Area `name` stays unique per branch (legacy unit.area string).
 */
export async function upsertArea(branchId, name, { cityId = null, brgyId = null } = {}) {
  const cleaned = cleanName(name);
  if (!cleaned) return null;

  await pool.query(
    `
    INSERT INTO area (branch_id, name, city_id, brgy_id, active)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      active = 1,
      name = VALUES(name),
      city_id = COALESCE(VALUES(city_id), city_id),
      brgy_id = COALESCE(VALUES(brgy_id), brgy_id),
      updated_at = CURRENT_TIMESTAMP
    `,
    [branchId, cleaned, cityId, brgyId],
  );

  if (cityId || brgyId) {
    await pool.query(
      `
      UPDATE area
      SET
        city_id = COALESCE(?, city_id),
        brgy_id = COALESCE(?, brgy_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE branch_id = ? AND LOWER(TRIM(name)) = LOWER(?)
      `,
      [cityId, brgyId, branchId, cleaned],
    );
  }

  return findAreaByName(branchId, cleaned);
}

/** Resolve city (+ optional brgy) and return linked area id for unit/property writes. */
export async function resolveAreaIds(branchId, cityName, brgyName = null) {
  const city = await upsertCity(branchId, cityName);
  if (!city) return null;

  let brgy = null;
  if (brgyName) {
    brgy = await upsertBrgy(city.city_id, brgyName);
  }

  const area = await upsertArea(branchId, city.name, {
    cityId: city.city_id,
    brgyId: brgy?.brgy_id ?? null,
  });

  return {
    cityId: city.city_id,
    brgyId: brgy?.brgy_id ?? null,
    areaId: area?.id ?? null,
    cityName: city.name,
    brgyName: brgy?.name ?? null,
  };
}

/* ───────────────────────── Seed / migrate ───────────────────────── */

export async function seedCitiesAndBrgysForBranch(branchId) {
  const existing = await listCities(branchId, { includeInactive: true });
  const hasActive = existing.some((row) => Number(row.active) === 1);

  // Only insert default cities on an empty branch.
  // Re-seeding every boot would recreate "Angeles City" after the user renames it.
  if (!hasActive) {
    for (const entry of CITY_BRGY_SEEDS) {
      const city = await upsertCity(branchId, entry.city);
      if (!city) continue;
      for (const brgyName of entry.barangays) {
        await upsertBrgy(city.city_id, brgyName);
      }
      await upsertArea(branchId, city.name, { cityId: city.city_id });
    }
    return;
  }

  // Branch already has cities: only fill barangays when a matched seed city has none yet.
  for (const entry of CITY_BRGY_SEEDS) {
    const city = await findCityByName(branchId, entry.city);
    if (!city || Number(city.active) !== 1) continue;
    const existingBrgys = await listBrgys(branchId, { cityId: city.city_id });
    if (existingBrgys.length > 0) continue;
    for (const brgyName of entry.barangays) {
      await upsertBrgy(city.city_id, brgyName);
    }
    await upsertArea(branchId, city.name, { cityId: city.city_id });
  }
}

export async function seedCitiesAndBrgysForAllBranches() {
  const [branches] = await pool.query(`SELECT id FROM branch`);
  for (const row of branches) {
    await seedCitiesAndBrgysForBranch(row.id);
    await mergeDuplicateCitiesForBranch(row.id);
  }
}

/** Soft-delete alias duplicates (e.g. "1. Clark" + "Clark"); keep numbered name. */
export async function mergeDuplicateCitiesForBranch(branchId) {
  const cities = await listCities(branchId, { includeInactive: false });
  const byAlias = new Map();
  for (const row of cities) {
    const key = aliasName(row.name).toLowerCase();
    if (!key) continue;
    const group = byAlias.get(key);
    if (!group) byAlias.set(key, [row]);
    else group.push(row);
  }

  for (const group of byAlias.values()) {
    if (group.length < 2) continue;
    const keep = group.reduce(preferCityRow);
    for (const drop of group) {
      if (String(drop.city_id) === String(keep.city_id)) continue;
      await reassignCityChildren(keep.city_id, drop.city_id, branchId);
      await softDeleteCity(drop.city_id, branchId);
    }
  }

  await ensureActiveCitiesNumbered(branchId);
}

/** Number any remaining bare city names as "N. Name". */
export async function ensureActiveCitiesNumbered(branchId) {
  const cities = await listCities(branchId, { includeInactive: false });
  const used = new Set();
  for (const row of cities) {
    const m = String(row.name ?? '')
      .trim()
      .match(/^#?(\d+)[.)\]:\-]\s+/u);
    if (m) used.add(Number(m[1]) || 0);
  }
  const takeNext = () => {
    let n = 1;
    while (used.has(n)) n += 1;
    used.add(n);
    return n;
  };

  for (const row of cities) {
    if (hasOrdinalPrefix(row.name)) continue;
    const base = aliasName(row.name) || cleanName(row.name);
    if (!base) continue;
    const numbered = `${takeNext()}. ${base}`;
    try {
      await renameCity(row.city_id, branchId, numbered);
    } catch (err) {
      console.warn('[ensureActiveCitiesNumbered] rename skipped:', err?.message ?? err);
    }
  }
}

/** Copy distinct location_building city/brgy pairs into normalized tables. */
export async function migrateLocationBuildingIntoCityBrgy() {
  const [rows] = await pool.query(
    `
    SELECT branch_id, location_name, building_name, active
    FROM location_building
    `,
  );

  for (const row of rows) {
    let city = await findCityByName(row.branch_id, row.location_name);
    if (!city) {
      // Do not recreate seed cities after the user renamed them (e.g. Angeles City → Angeles City1).
      const existingCities = await listCities(row.branch_id, { includeInactive: true });
      if (existingCities.some((c) => Number(c.active) === 1)) {
        continue;
      }
      city = await upsertCity(row.branch_id, row.location_name);
    }
    if (!city) continue;

    const existingBrgys = await listBrgys(row.branch_id, { cityId: city.city_id });
    // Once a city already has barangays, do not re-create renamed/deleted seed names from location_building.
    if (existingBrgys.length > 0) {
      const cleanedBuilding = cleanName(row.building_name);
      const match = existingBrgys.find(
        (b) => String(b.name).trim().toLowerCase() === cleanedBuilding.toLowerCase(),
      );
      if (!match) continue;
      if (Number(row.active) === 0 && Number(match.active) === 1) {
        await softDeleteBrgy(match.brgy_id, row.branch_id);
      }
      continue;
    }

    const brgy = await upsertBrgy(city.city_id, row.building_name);
    if (Number(row.active) === 0) {
      if (brgy) {
        await pool.query(`UPDATE brgy SET active = 0 WHERE brgy_id = ?`, [brgy.brgy_id]);
      }
    } else {
      await upsertArea(row.branch_id, city.name, {
        cityId: city.city_id,
        brgyId: brgy?.brgy_id ?? null,
      });
    }
  }
}

/**
 * Strip leading list numbers from area / location_building names
 * (e.g. "1. Angeles City" → "Angeles City"). When the clean name already
 * exists, move dependents onto that row and drop the ordinal duplicate.
 */
export async function stripOrdinalPrefixesFromLocations() {
  // Cities: normalize in-place / merge via existing helper.
  const [branches] = await pool.query(`SELECT id FROM branch`);
  for (const branch of branches) {
    await mergeDuplicateCitiesForBranch(branch.id);
  }

  // Areas with ordinal prefixes.
  const [areas] = await pool.query(
    `SELECT id, branch_id, name, city_id, brgy_id, active FROM area`,
  );
  for (const row of areas) {
    const raw = String(row.name ?? '').trim();
    const cleaned = cleanName(raw);
    if (!cleaned || cleaned.toLowerCase() === raw.toLowerCase()) continue;

    const [existing] = await pool.query(
      `
      SELECT id, city_id, brgy_id, active
      FROM area
      WHERE branch_id <=> ? AND LOWER(TRIM(name)) = LOWER(?) AND id <> ?
      LIMIT 1
      `,
      [row.branch_id, cleaned, row.id],
    );
    const keep = existing[0] ?? null;
    if (keep) {
      await pool.query(`UPDATE property SET area_id = ? WHERE area_id = ?`, [keep.id, row.id]);
      if (Number(keep.active) !== 1) {
        await pool.query(
          `UPDATE area SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [keep.id],
        );
      }
      if (keep.city_id == null && row.city_id != null) {
        await pool.query(
          `UPDATE area SET city_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [row.city_id, keep.id],
        );
      }
      await pool.query(`DELETE FROM area WHERE id = ?`, [row.id]);
    } else {
      try {
        await pool.query(
          `
          UPDATE area
          SET name = ?, city = COALESCE(city, ?), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          `,
          [cleaned, cleaned, row.id],
        );
      } catch (e) {
        if (e?.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
  }

  // location_building location_name ordinals.
  const [lbs] = await pool.query(
    `SELECT id, branch_id, location_name, building_name, active FROM location_building`,
  );
  for (const row of lbs) {
    const raw = String(row.location_name ?? '').trim();
    const cleaned = cleanName(raw);
    if (!cleaned || cleaned.toLowerCase() === raw.toLowerCase()) continue;

    const [clash] = await pool.query(
      `
      SELECT id, active
      FROM location_building
      WHERE branch_id = ?
        AND LOWER(TRIM(location_name)) = LOWER(?)
        AND LOWER(TRIM(building_name)) = LOWER(?)
        AND id <> ?
      LIMIT 1
      `,
      [row.branch_id, cleaned, row.building_name, row.id],
    );
    if (clash[0]) {
      await pool.query(`DELETE FROM location_building WHERE id = ?`, [row.id]);
      continue;
    }
    try {
      await pool.query(
        `
        UPDATE location_building
        SET location_name = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [cleaned, row.id],
      );
    } catch (e) {
      if (e?.code === 'ER_DUP_ENTRY') {
        await pool.query(`DELETE FROM location_building WHERE id = ?`, [row.id]);
      } else {
        throw e;
      }
    }
  }
}

/** Backfill area.city_id from matching city.name / area.city string. */
export async function backfillAreaCityBrgyIds() {
  await pool.query(
    `
    UPDATE area a
    JOIN city c
      ON c.branch_id = a.branch_id
     AND LOWER(TRIM(c.name)) = LOWER(TRIM(a.name))
    SET a.city_id = c.city_id
    WHERE a.city_id IS NULL
    `,
  );

  await pool.query(
    `
    UPDATE area a
    JOIN city c
      ON c.branch_id = a.branch_id
     AND a.city IS NOT NULL
     AND LOWER(TRIM(c.name)) = LOWER(TRIM(a.city))
    SET a.city_id = c.city_id
    WHERE a.city_id IS NULL
    `,
  );
}
