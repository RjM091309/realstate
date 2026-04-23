import { loadSessionPayload } from '../services/sessionService.js';
import { listAuditLogsByBranch } from '../models/auditLogsModel.js';

function fmtDateTime(d) {
  if (d == null) return '';
  if (typeof d === 'string') return d.slice(0, 19).replace('T', ' ');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
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

export async function listAuditLogs(req, res) {
  const ctx = await getAuthContext(req, res);
  if (!ctx) return;
  try {
    const rows = await listAuditLogsByBranch(ctx.session.branchId, {
      moduleName: req.query?.module_name ?? req.query?.moduleName ?? null,
      recordTable: req.query?.record_table ?? req.query?.recordTable ?? null,
      actorUserId: req.query?.actor_user_id ?? req.query?.actorUserId ?? null,
      recordId: req.query?.record_id ?? req.query?.recordId ?? null,
      limit: req.query?.limit ?? 100,
    });
    const logs = rows.map((r) => ({
      id: String(r.id),
      branchId: r.branch_id != null ? String(r.branch_id) : '',
      actorUserId: r.actor_user_id != null ? String(r.actor_user_id) : '',
      moduleName: String(r.module_name ?? ''),
      recordTable: String(r.record_table ?? ''),
      recordId: r.record_id != null ? String(r.record_id) : '',
      action: String(r.action ?? ''),
      changeSummary: r.change_summary ? String(r.change_summary) : '',
      createdAt: r.created_at ? fmtDateTime(r.created_at) : '',
    }));
    res.json({ logs });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load audit logs' });
  }
}

