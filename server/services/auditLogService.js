import { insertAuditLog } from '../models/auditLogsModel.js';

export async function logAudit(payload) {
  try {
    await insertAuditLog(payload);
  } catch (e) {
    // Never break main flows for audit failures
    console.warn('[auditLog] failed to write audit log:', e instanceof Error ? e.message : String(e));
  }
}

