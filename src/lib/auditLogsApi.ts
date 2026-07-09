import { apiFetch } from '@/lib/api';

export type AuditLog = {
  id: string;
  branchId: string;
  actorUserId: string;
  moduleName: string;
  recordTable: string;
  recordId: string;
  action: string;
  changeSummary: string;
  createdAt: string;
};

type AuditLogsResponse = {
  logs: AuditLog[];
};

export type AuditLogFilters = {
  moduleName?: string;
  recordTable?: string;
  actorUserId?: string;
  recordId?: string;
  limit?: number;
};

export async function fetchAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const params = new URLSearchParams();
  if (filters.moduleName) params.set('module_name', filters.moduleName);
  if (filters.recordTable) params.set('record_table', filters.recordTable);
  if (filters.actorUserId) params.set('actor_user_id', filters.actorUserId);
  if (filters.recordId) params.set('record_id', filters.recordId);
  if (filters.limit) params.set('limit', String(filters.limit));

  const query = params.toString();
  const res = await apiFetch<AuditLogsResponse>(`/api/audit-logs${query ? `?${query}` : ''}`);
  return res.logs;
}
