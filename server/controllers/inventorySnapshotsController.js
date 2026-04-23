import { loadSessionPayload } from '../services/sessionService.js';
import { getContractById } from '../models/contractsModel.js';
import {
  insertInventorySnapshot,
  insertInventorySnapshotItem,
  listInventorySnapshotItems,
  listInventorySnapshotsByContract,
  updateInventorySnapshotById,
  deleteInventorySnapshotById,
  updateInventorySnapshotItemById,
  deleteInventorySnapshotItemById,
} from '../models/inventorySnapshotsModel.js';

function fmtDate(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  return { session };
}

function canUpdate(session) {
  const permissions = session.crud?.contracts;
  return Boolean(permissions?.update);
}

function rowToSnapshot(row) {
  return {
    id: String(row.id),
    contractId: String(row.contract_id),
    snapshotType: String(row.snapshot_type),
    inspectionDate: row.inspection_date ? fmtDate(row.inspection_date) : '',
    inspectedBy: row.inspected_by != null ? String(row.inspected_by) : undefined,
    remarks: row.remarks ? String(row.remarks) : '',
    createdAt: row.created_at ? fmtDate(row.created_at) : '',
  };
}

function rowToItem(row) {
  return {
    id: String(row.id),
    snapshotId: String(row.snapshot_id),
    itemName: String(row.item_name ?? ''),
    category: row.category ? String(row.category) : '',
    quantity: Number(row.quantity ?? 1),
    conditionState: String(row.condition_state ?? 'good'),
    notes: row.notes ? String(row.notes) : '',
  };
}

export async function listContractInventorySnapshots(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const contractId = String(req.params.contractId ?? '').trim();
  if (!contractId) {
    res.status(400).json({ error: 'Invalid contractId' });
    return;
  }
  try {
    const contract = await getContractById(contractId, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const rows = await listInventorySnapshotsByContract(contractId, ctx.session.branchId);
    const snapshots = rows.map(rowToSnapshot);
    res.json({ snapshots });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load inventory snapshots' });
  }
}

export async function listInventorySnapshotItemsView(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  const snapshotId = String(req.params.snapshotId ?? '').trim();
  if (!snapshotId) {
    res.status(400).json({ error: 'Invalid snapshotId' });
    return;
  }
  try {
    const rows = await listInventorySnapshotItems(snapshotId, ctx.session.branchId);
    res.json({ items: rows.map(rowToItem) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load snapshot items' });
  }
}

function validateCreateSnapshot(body) {
  const contractId = String(body.contractId ?? '').trim();
  const snapshotType = String(body.snapshotType ?? '').trim();
  const inspectionDate = String(body.inspectionDate ?? '').trim().slice(0, 10);
  if (!contractId) return null;
  if (snapshotType !== 'move_in' && snapshotType !== 'move_out' && snapshotType !== 'routine') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate)) return null;
  const remarksRaw = body.remarks;
  const remarks = remarksRaw == null ? null : String(remarksRaw).trim() || null;
  return { contractId, snapshotType, inspectionDate, remarks };
}

export async function createInventorySnapshot(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canUpdate(ctx.session)) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const parsed = validateCreateSnapshot(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid snapshot payload' });
    return;
  }
  try {
    const contract = await getContractById(parsed.contractId, ctx.session.branchId);
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    const id = await insertInventorySnapshot(ctx.session.branchId, {
      contractId: parsed.contractId,
      snapshotType: parsed.snapshotType,
      inspectionDate: parsed.inspectionDate,
      inspectedBy: ctx.session.user.id,
      remarks: parsed.remarks,
    });
    res.status(201).json({ ok: true, snapshotId: String(id) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create snapshot' });
  }
}

function validateCreateItem(body) {
  const snapshotId = String(body.snapshotId ?? '').trim();
  const itemName = String(body.itemName ?? '').trim();
  if (!snapshotId || !itemName) return null;
  const categoryRaw = body.category;
  const category = categoryRaw == null ? null : String(categoryRaw).trim() || null;
  const quantity = Number(body.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const conditionState = String(body.conditionState ?? 'good').trim();
  const allowed = new Set(['excellent', 'good', 'fair', 'damaged', 'missing']);
  if (!allowed.has(conditionState)) return null;
  const notesRaw = body.notes;
  const notes = notesRaw == null ? null : String(notesRaw).trim() || null;
  return { snapshotId, itemName, category, quantity, conditionState, notes };
}

export async function createInventorySnapshotItem(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canUpdate(ctx.session)) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const parsed = validateCreateItem(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid item payload' });
    return;
  }
  try {
    const id = await insertInventorySnapshotItem(ctx.session.branchId, parsed);
    if (!id) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }
    res.status(201).json({ ok: true, itemId: String(id) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to create item' });
  }
}

function validatePatchSnapshot(body) {
  const snapshotType = String(body.snapshotType ?? '').trim();
  const inspectionDate = String(body.inspectionDate ?? '').trim().slice(0, 10);
  if (snapshotType !== 'move_in' && snapshotType !== 'move_out' && snapshotType !== 'routine') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inspectionDate)) return null;
  const remarksRaw = body.remarks;
  const remarks = remarksRaw == null ? null : String(remarksRaw).trim() || null;
  return { snapshotType, inspectionDate, remarks };
}

export async function patchInventorySnapshot(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canUpdate(ctx.session)) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const snapshotId = String(req.params.snapshotId ?? '').trim();
  if (!snapshotId) {
    res.status(400).json({ error: 'Invalid snapshotId' });
    return;
  }
  const parsed = validatePatchSnapshot(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid snapshot payload' });
    return;
  }
  try {
    const contractId = await updateInventorySnapshotById(ctx.session.branchId, snapshotId, {
      snapshotType: parsed.snapshotType,
      inspectionDate: parsed.inspectionDate,
      remarks: parsed.remarks,
    });
    if (!contractId) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }
    res.json({ ok: true, contractId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update snapshot' });
  }
}

export async function removeInventorySnapshot(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canUpdate(ctx.session)) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const snapshotId = String(req.params.snapshotId ?? '').trim();
  if (!snapshotId) {
    res.status(400).json({ error: 'Invalid snapshotId' });
    return;
  }
  try {
    const contractId = await deleteInventorySnapshotById(ctx.session.branchId, snapshotId);
    if (!contractId) {
      res.status(404).json({ error: 'Snapshot not found' });
      return;
    }
    res.json({ ok: true, contractId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete snapshot' });
  }
}

function validatePatchItem(body) {
  const itemName = String(body.itemName ?? '').trim();
  if (!itemName) return null;
  const categoryRaw = body.category;
  const category = categoryRaw == null ? null : String(categoryRaw).trim() || null;
  const quantity = Number(body.quantity ?? 1);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const conditionState = String(body.conditionState ?? 'good').trim();
  const allowed = new Set(['excellent', 'good', 'fair', 'damaged', 'missing']);
  if (!allowed.has(conditionState)) return null;
  const notesRaw = body.notes;
  const notes = notesRaw == null ? null : String(notesRaw).trim() || null;
  return { itemName, category, quantity, conditionState, notes };
}

export async function patchInventorySnapshotItem(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canUpdate(ctx.session)) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const itemId = String(req.params.itemId ?? '').trim();
  if (!itemId) {
    res.status(400).json({ error: 'Invalid itemId' });
    return;
  }
  const parsed = validatePatchItem(req.body ?? {});
  if (!parsed) {
    res.status(400).json({ error: 'Invalid item payload' });
    return;
  }
  try {
    const snapshotId = await updateInventorySnapshotItemById(ctx.session.branchId, itemId, {
      itemName: parsed.itemName,
      category: parsed.category,
      quantity: parsed.quantity,
      conditionState: parsed.conditionState,
      notes: parsed.notes,
    });
    if (!snapshotId) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ ok: true, snapshotId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update item' });
  }
}

export async function removeInventorySnapshotItem(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canUpdate(ctx.session)) {
    res.status(403).json({ error: 'No permission to update contracts' });
    return;
  }
  const itemId = String(req.params.itemId ?? '').trim();
  if (!itemId) {
    res.status(400).json({ error: 'Invalid itemId' });
    return;
  }
  try {
    const snapshotId = await deleteInventorySnapshotItemById(ctx.session.branchId, itemId);
    if (!snapshotId) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    res.json({ ok: true, snapshotId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to delete item' });
  }
}

