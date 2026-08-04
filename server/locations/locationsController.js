import { loadSessionPayload } from '../services/sessionService.js';
import {
  getAreaById,
  getBrgyById,
  getCityById,
  listAreas,
  listBrgys,
  listCities,
  mergeDuplicateCitiesForBranch,
  renameBrgy,
  renameCity,
  softDeleteBrgy,
  softDeleteCity,
  upsertArea,
  upsertBrgy,
  upsertCity,
} from './locationsModel.js';

function cityDto(row) {
  return {
    cityId: String(row.city_id),
    name: String(row.name ?? ''),
    active: Number(row.active) === 1,
  };
}

function brgyDto(row) {
  return {
    brgyId: String(row.brgy_id),
    cityId: String(row.city_id),
    cityName: row.city_name != null ? String(row.city_name) : undefined,
    name: String(row.name ?? ''),
    active: Number(row.active) === 1,
  };
}

function areaDto(row) {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    cityId: row.city_id != null ? String(row.city_id) : null,
    brgyId: row.brgy_id != null ? String(row.brgy_id) : null,
    cityName: row.city_name != null ? String(row.city_name) : row.city != null ? String(row.city) : null,
    brgyName: row.brgy_name != null ? String(row.brgy_name) : null,
    active: Number(row.active) === 1,
  };
}

async function getAuthContext(req, res) {
  const userId = req.userId;
  if (userId == null) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const session = await loadSessionPayload(userId);
  if (!session) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  return { userId, session };
}

function canCrud(session, op) {
  const permissions = session.crud?.units;
  if (!permissions) return false;
  if (op === 'create') return Boolean(permissions.create);
  if (op === 'update') return Boolean(permissions.update);
  return Boolean(permissions.delete);
}

/* ── Cities ── */

export async function listCitiesHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    // Heal ordinal/bare duplicates and ensure "N. Name" format for CITY category.
    await mergeDuplicateCitiesForBranch(ctx.session.branchId);
    const rows = await listCities(ctx.session.branchId);
    res.json({ cities: rows.map(cityDto) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load cities' });
  }
}

export async function createCityHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create') && !canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to manage cities' });
    return;
  }
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    await mergeDuplicateCitiesForBranch(ctx.session.branchId);
    const existing = await listCities(ctx.session.branchId).then((rows) =>
      rows.find(
        (r) =>
          String(r.name).toLowerCase() === name.toLowerCase() ||
          String(r.name)
            .trim()
            .replace(/^#?\d+[.)\]:\-]\s*/u, '')
            .toLowerCase() ===
            name
              .trim()
              .replace(/^#?\d+[.)\]:\-]\s*/u, '')
              .toLowerCase(),
      ),
    );
    const row = await upsertCity(ctx.session.branchId, name);
    res.status(existing ? 200 : 201).json({ city: cityDto(row) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create city' });
  }
}

export async function updateCityHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update') && !canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to update cities' });
    return;
  }
  const cityId = Number(req.params.cityId);
  const name = String(req.body?.name ?? '').trim();
  if (!cityId || !name) {
    res.status(400).json({ error: 'cityId and name are required' });
    return;
  }
  try {
    const existing = await getCityById(cityId, ctx.session.branchId);
    if (!existing || Number(existing.active) !== 1) {
      res.status(404).json({ error: 'City not found' });
      return;
    }
    const n = await renameCity(cityId, ctx.session.branchId, name);
    if (!n) {
      res.status(404).json({ error: 'City not found' });
      return;
    }
    const row = await getCityById(cityId, ctx.session.branchId);
    res.json({ city: cityDto(row) });
  } catch (e) {
    if (e?.message === 'CITY_EXISTS') {
      res.status(409).json({ error: 'City already exists' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: e?.message || 'Failed to update city' });
  }
}

export async function deleteCityHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete cities' });
    return;
  }
  const cityId = Number(req.params.cityId);
  if (!cityId) {
    res.status(400).json({ error: 'cityId is required' });
    return;
  }
  try {
    const n = await softDeleteCity(cityId, ctx.session.branchId);
    if (!n) {
      res.status(404).json({ error: 'City not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete city' });
  }
}

/* ── Brgys ── */

export async function listBrgysHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const cityId = req.query.cityId ? Number(req.query.cityId) : null;
    const rows = await listBrgys(ctx.session.branchId, {
      cityId: Number.isFinite(cityId) && cityId > 0 ? cityId : null,
    });
    res.json({ brgys: rows.map(brgyDto) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load barangays' });
  }
}

export async function createBrgyHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create') && !canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to manage barangays' });
    return;
  }
  const cityId = Number(req.body?.cityId);
  const name = String(req.body?.name ?? '').trim();
  if (!cityId || !name) {
    res.status(400).json({ error: 'cityId and name are required' });
    return;
  }
  try {
    const city = await getCityById(cityId, ctx.session.branchId);
    if (!city || Number(city.active) !== 1) {
      res.status(404).json({ error: 'City not found' });
      return;
    }
    const row = await upsertBrgy(cityId, name);
    const full = await getBrgyById(row.brgy_id, ctx.session.branchId);
    res.status(201).json({ brgy: brgyDto(full) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create barangay' });
  }
}

export async function updateBrgyHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'update') && !canCrud(ctx.session, 'create')) {
    res.status(403).json({ error: 'No permission to update barangays' });
    return;
  }
  const brgyId = Number(req.params.brgyId);
  const name = String(req.body?.name ?? '').trim();
  if (!brgyId || !name) {
    res.status(400).json({ error: 'brgyId and name are required' });
    return;
  }
  try {
    const existing = await getBrgyById(brgyId, ctx.session.branchId);
    if (!existing || Number(existing.active) !== 1) {
      res.status(404).json({ error: 'Barangay not found' });
      return;
    }
    await renameBrgy(brgyId, ctx.session.branchId, name);
    const row = await getBrgyById(brgyId, ctx.session.branchId);
    res.json({ brgy: brgyDto(row) });
  } catch (e) {
    if (e?.message === 'BRGY_EXISTS') {
      res.status(409).json({ error: 'Barangay already exists' });
      return;
    }
    console.error(e);
    res.status(500).json({ error: 'Failed to update barangay' });
  }
}

export async function deleteBrgyHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'delete')) {
    res.status(403).json({ error: 'No permission to delete barangays' });
    return;
  }
  const brgyId = Number(req.params.brgyId);
  if (!brgyId) {
    res.status(400).json({ error: 'brgyId is required' });
    return;
  }
  try {
    const n = await softDeleteBrgy(brgyId, ctx.session.branchId);
    if (!n) {
      res.status(404).json({ error: 'Barangay not found' });
      return;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete barangay' });
  }
}

/* ── Areas ── */

export async function listAreasHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const cityId = req.query.cityId ? Number(req.query.cityId) : null;
    const brgyId = req.query.brgyId ? Number(req.query.brgyId) : null;
    const rows = await listAreas(ctx.session.branchId, {
      cityId: Number.isFinite(cityId) && cityId > 0 ? cityId : null,
      brgyId: Number.isFinite(brgyId) && brgyId > 0 ? brgyId : null,
    });
    res.json({ areas: rows.map(areaDto) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load areas' });
  }
}

export async function createAreaHandler(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canCrud(ctx.session, 'create') && !canCrud(ctx.session, 'update')) {
    res.status(403).json({ error: 'No permission to manage areas' });
    return;
  }
  const name = String(req.body?.name ?? '').trim();
  const cityId = req.body?.cityId != null ? Number(req.body.cityId) : null;
  const brgyId = req.body?.brgyId != null ? Number(req.body.brgyId) : null;
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  try {
    if (cityId) {
      const city = await getCityById(cityId, ctx.session.branchId);
      if (!city || Number(city.active) !== 1) {
        res.status(404).json({ error: 'City not found' });
        return;
      }
    }
    if (brgyId) {
      const brgy = await getBrgyById(brgyId, ctx.session.branchId);
      if (!brgy || Number(brgy.active) !== 1) {
        res.status(404).json({ error: 'Barangay not found' });
        return;
      }
    }
    const row = await upsertArea(ctx.session.branchId, name, { cityId, brgyId });
    const full = await getAreaById(row.id, ctx.session.branchId);
    res.status(201).json({ area: areaDto(full) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create area' });
  }
}
