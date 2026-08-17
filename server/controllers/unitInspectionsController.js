import { loadSessionPayload } from '../services/sessionService.js';
import { getContractById, getContractDocumentDetails } from '../models/contractsModel.js';
import { updateUnitStatusById } from '../models/unitsModel.js';
import { streamInspectionReportPdf } from '../services/inspectionReportPdfService.js';
import {
  REQUIRED_PHOTO_SECTIONS,
  approveInspection,
  computeChecklistScore,
  computeInventoryCompletion,
  computePhotosComplete,
  createOrGetInspection,
  deleteInspectionPhoto,
  failInspection,
  getInspectionByContractId,
  getInspectionById,
  insertInspectionLog,
  insertInspectionPhoto,
  listChecklistItems,
  listInspectionLogs,
  listInspectionPhotos,
  listInspectionsByBranch,
  listInventoryVerifications,
  refreshInspectionMetrics,
  rowToChecklist,
  rowToInspection,
  rowToInventoryVerification,
  rowToLog,
  rowToPhoto,
  scheduleMoveIn,
  startInspection,
  updateChecklistItem,
  updateInspectionFields,
  updateInventoryVerification,
} from '../models/unitInspectionsModel.js';

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
  return { session, userId };
}

function canRead(session) {
  return Boolean(session.crud?.contracts?.update || session.crud?.contracts?.create || session.crud?.contracts?.delete);
}

function canWrite(session) {
  return Boolean(session.crud?.contracts?.update);
}

async function loadFullInspection(inspectionRow) {
  const inspectionId = inspectionRow.id;
  const [checklist, inventory, photos, logs] = await Promise.all([
    listChecklistItems(inspectionId),
    listInventoryVerifications(inspectionId),
    listInspectionPhotos(inspectionId),
    listInspectionLogs(inspectionId),
  ]);
  return {
    inspection: rowToInspection(inspectionRow),
    checklist: checklist.map(rowToChecklist),
    inventory: inventory.map(rowToInventoryVerification),
    photos: photos.map(rowToPhoto),
    logs: logs.map(rowToLog),
  };
}

async function assertContractAccess(contractId, branchId) {
  const contract = await getContractById(contractId, branchId);
  if (!contract) return { error: 'Contract not found', status: 404 };
  return { contract };
}

/** Lightweight branch-wide feed for the Calendar's auto-generated "Inspection" events. */
export async function listBranchInspectionsForCalendar(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canRead(ctx.session)) {
    res.status(403).json({ error: 'No permission to view inspections' });
    return;
  }
  try {
    const rows = await listInspectionsByBranch(ctx.session.branchId);
    res.json({
      inspections: rows.map((r) => {
        const tower = r.unit_tower ? `${r.unit_tower} · ` : '';
        return {
          id: String(r.id),
          contractId: String(r.contract_id),
          unitId: String(r.unit_id),
          status: String(r.status),
          scheduledDate: r.scheduled_move_in ? String(r.scheduled_move_in).slice(0, 10) : null,
          contractNo: String(r.contract_no ?? ''),
          unitLabel: `${tower}${r.unit_number ?? ''}`.trim() || '—',
          buildingName: String(r.building_name ?? ''),
          tenantName: String(r.tenant_name ?? '').trim() || '—',
        };
      }),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load inspections' });
  }
}

export async function getContractInspection(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canRead(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const contractId = String(req.params.contractId ?? '').trim();
  const access = await assertContractAccess(contractId, ctx.session.branchId);
  if (access.error) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  try {
    let row = await getInspectionByContractId(contractId, ctx.session.branchId);
    if (!row) {
      row = await createOrGetInspection({
        branchId: ctx.session.branchId,
        contractId,
        unitId: access.contract.unit_id,
        actorUserId: ctx.userId,
      });
    }
    const payload = await loadFullInspection(row);
    res.json(payload);
  } catch (e) {
    console.error('[unit-inspection] getContractInspection', e);
    res.status(500).json({ error: 'Failed to load inspection' });
  }
}

export async function startContractInspection(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const contractId = String(req.params.contractId ?? '').trim();
  const access = await assertContractAccess(contractId, ctx.session.branchId);
  if (access.error) {
    res.status(access.status).json({ error: access.error });
    return;
  }
  try {
    let row = await getInspectionByContractId(contractId, ctx.session.branchId);
    if (!row) {
      row = await createOrGetInspection({
        branchId: ctx.session.branchId,
        contractId,
        unitId: access.contract.unit_id,
        actorUserId: ctx.userId,
      });
    }
    row = await startInspection(row.id, ctx.session.branchId, ctx.userId);
    await refreshInspectionMetrics(row.id);
    row = await getInspectionById(row.id, ctx.session.branchId);
    const payload = await loadFullInspection(row);
    res.json(payload);
  } catch (e) {
    console.error('[unit-inspection] startContractInspection', e);
    res.status(500).json({ error: 'Failed to start inspection' });
  }
}

export async function patchInspection(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  try {
    await updateInspectionFields(inspectionId, ctx.session.branchId, {
      workflowStep: req.body?.workflowStep,
      inspectorRemarks: req.body?.inspectorRemarks,
      scheduledMoveIn: req.body?.scheduledMoveIn,
      status: req.body?.status,
    });
    if (req.body?.workflowStep) {
      await insertInspectionLog(
        inspectionId,
        'workflow_step_changed',
        `Workflow step changed to ${req.body.workflowStep}.`,
        ctx.userId,
      );
    }
    await refreshInspectionMetrics(inspectionId);
    const updated = await getInspectionById(inspectionId, ctx.session.branchId);
    res.json(await loadFullInspection(updated));
  } catch (e) {
    console.error('[unit-inspection] patchInspection', e);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
}

export async function patchChecklistItem(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const itemId = String(req.params.itemId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const result = String(req.body?.result ?? '').trim();
  if (result && !['pending', 'pass', 'fail'].includes(result)) {
    res.status(400).json({ error: 'Invalid checklist result' });
    return;
  }
  try {
    await updateChecklistItem(inspectionId, itemId, {
      result: result || undefined,
      remarks: req.body?.remarks,
      photoDataUrl: req.body?.photoDataUrl,
    });
    await insertInspectionLog(inspectionId, 'checklist_updated', 'Checklist item updated.', ctx.userId);
    await refreshInspectionMetrics(inspectionId);
    const updated = await getInspectionById(inspectionId, ctx.session.branchId);
    res.json(await loadFullInspection(updated));
  } catch (e) {
    console.error('[unit-inspection] patchChecklistItem', e);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
}

export async function patchInventoryItem(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const itemId = String(req.params.itemId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const conditionState = String(req.body?.conditionState ?? '').trim();
  if (conditionState && !['pending', 'good', 'damaged', 'missing'].includes(conditionState)) {
    res.status(400).json({ error: 'Invalid inventory condition' });
    return;
  }
  try {
    await updateInventoryVerification(inspectionId, itemId, {
      conditionState: conditionState || undefined,
      quantity: req.body?.quantity != null ? Number(req.body.quantity) : undefined,
      remarks: req.body?.remarks,
    });
    await insertInspectionLog(inspectionId, 'inventory_updated', 'Inventory verification updated.', ctx.userId);
    await refreshInspectionMetrics(inspectionId);
    const updated = await getInspectionById(inspectionId, ctx.session.branchId);
    res.json(await loadFullInspection(updated));
  } catch (e) {
    console.error('[unit-inspection] patchInventoryItem', e);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
}

export async function addInspectionPhoto(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const section = String(req.body?.section ?? '').trim();
  const photoDataUrl = String(req.body?.photoDataUrl ?? '').trim();
  const allowed = ['living_room', 'bedroom', 'kitchen', 'bathroom', 'damages', 'meter_reading'];
  if (!allowed.includes(section) || !photoDataUrl) {
    res.status(400).json({ error: 'Invalid photo payload' });
    return;
  }
  try {
    await insertInspectionPhoto(inspectionId, section, photoDataUrl, req.body?.caption ?? null);
    await insertInspectionLog(inspectionId, 'photos_uploaded', `Photo uploaded for ${section}.`, ctx.userId);
    await refreshInspectionMetrics(inspectionId);
    const updated = await getInspectionById(inspectionId, ctx.session.branchId);
    res.json(await loadFullInspection(updated));
  } catch (e) {
    console.error('[unit-inspection] addInspectionPhoto', e);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
}

export async function removeInspectionPhoto(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const photoId = String(req.params.photoId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  try {
    await deleteInspectionPhoto(inspectionId, photoId);
    await refreshInspectionMetrics(inspectionId);
    const updated = await getInspectionById(inspectionId, ctx.session.branchId);
    res.json(await loadFullInspection(updated));
  } catch (e) {
    console.error('[unit-inspection] removeInspectionPhoto', e);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
}

async function validateApproval(inspectionId) {
  const checklistScore = await computeChecklistScore(inspectionId);
  const inventoryCompletion = await computeInventoryCompletion(inspectionId);
  if (checklistScore < 100) {
    return { ok: false, error: 'Checklist must be 100% complete before approval.' };
  }
  if (inventoryCompletion < 100) {
    return { ok: false, error: 'Inventory verification must be 100% complete before approval.' };
  }
  return { ok: true };
}

export async function saveInspectionDraft(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  try {
    await updateInspectionFields(inspectionId, ctx.session.branchId, {
      inspectorRemarks: req.body?.inspectorRemarks,
      workflowStep: req.body?.workflowStep,
    });
    await insertInspectionLog(inspectionId, 'draft_saved', 'Inspection draft saved.', ctx.userId);
    await refreshInspectionMetrics(inspectionId);
    const updated = await getInspectionById(inspectionId, ctx.session.branchId);
    res.json(await loadFullInspection(updated));
  } catch (e) {
    console.error('[unit-inspection] saveInspectionDraft', e);
    res.status(500).json({ error: 'Failed to save draft' });
  }
}

export async function approveInspectionAction(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  const validation = await validateApproval(inspectionId);
  if (!validation.ok) {
    res.status(400).json({ error: validation.error });
    return;
  }
  try {
    if (req.body?.inspectorRemarks !== undefined) {
      await updateInspectionFields(inspectionId, ctx.session.branchId, {
        inspectorRemarks: req.body.inspectorRemarks,
      });
    }
    const updatedRow = await approveInspection(inspectionId, ctx.session.branchId, ctx.userId);
    await updateUnitStatusById(String(row.unit_id), ctx.session.branchId, 'Reserved');
    const payload = await loadFullInspection(updatedRow);
    res.json(payload);
  } catch (e) {
    console.error('[unit-inspection] approveInspectionAction', e);
    res.status(500).json({ error: 'Failed to approve inspection' });
  }
}

export async function failInspectionAction(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  try {
    if (req.body?.inspectorRemarks !== undefined) {
      await updateInspectionFields(inspectionId, ctx.session.branchId, {
        inspectorRemarks: req.body.inspectorRemarks,
      });
    }
    const updatedRow = await failInspection(inspectionId, ctx.session.branchId, ctx.userId);
    await updateUnitStatusById(String(row.unit_id), ctx.session.branchId, 'Maintenance');
    const payload = await loadFullInspection(updatedRow);
    res.json(payload);
  } catch (e) {
    console.error('[unit-inspection] failInspectionAction', e);
    res.status(500).json({ error: 'Failed to fail inspection' });
  }
}

export async function scheduleMoveInAction(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canWrite(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const moveInDate = String(req.body?.moveInDate ?? '').trim().slice(0, 10);
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  if (!moveInDate) {
    res.status(400).json({ error: 'moveInDate is required' });
    return;
  }
  if (row.status !== 'ready_for_occupancy' && row.status !== 'move_in_scheduled') {
    res.status(400).json({ error: 'Inspection must be approved before scheduling move-in.' });
    return;
  }
  try {
    const updatedRow = await scheduleMoveIn(inspectionId, ctx.session.branchId, moveInDate, ctx.userId);
    const payload = await loadFullInspection(updatedRow);
    res.json(payload);
  } catch (e) {
    console.error('[unit-inspection] scheduleMoveInAction', e);
    res.status(500).json({ error: 'Failed to schedule move-in' });
  }
}

export async function downloadInspectionReport(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  if (!canRead(ctx.session)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const inspectionId = String(req.params.inspectionId ?? '').trim();
  const row = await getInspectionById(inspectionId, ctx.session.branchId);
  if (!row) {
    res.status(404).json({ error: 'Inspection not found' });
    return;
  }
  if (row.status !== 'ready_for_occupancy' && row.status !== 'move_in_scheduled') {
    res.status(400).json({ error: 'Report is available after inspection approval.' });
    return;
  }
  try {
    const payload = await loadFullInspection(row);
    const details = await getContractDocumentDetails(String(row.contract_id), ctx.session.branchId);
    const contractNo = String(details?.contract_no ?? row.contract_id ?? 'inspection').replace(
      /[^\w.-]+/g,
      '_',
    );
    const fileName = `Inspection_${contractNo}_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.pdf`;
    streamInspectionReportPdf(res, { payload, details, fileName });
  } catch (e) {
    console.error('[unit-inspection] downloadInspectionReport', e);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate inspection report' });
    }
  }
}
