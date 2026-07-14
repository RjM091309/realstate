import { apiFetch } from '@/lib/api';

export type BlacklistEntityType = 'tenant' | 'broker';

export type BlacklistTypeFilter = 'all' | BlacklistEntityType;

export type BlacklistRecord = {
  id: string;
  branchId: string;
  entityType: BlacklistEntityType;
  tenantId?: string;
  partnerAgencyId?: string;
  name: string;
  email?: string;
  phone?: string;
  governmentId?: string;
  type: 'Tenant' | 'Broker';
  reason: string;
  blacklistedBy?: string;
  blacklistedByName?: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
};

/** @deprecated use BlacklistRecord */
export type BlacklistRowDto = BlacklistRecord;

export type BlacklistCreateBody = {
  entityType: BlacklistEntityType;
  name: string;
  email?: string;
  phone?: string;
  governmentId?: string;
  reason: string;
  tenantId?: string;
  partnerAgencyId?: string;
};

export type BlacklistListParams = {
  type?: BlacklistTypeFilter;
  search?: string;
};

function buildBlacklistQuery(params?: BlacklistListParams): string {
  const q = new URLSearchParams();
  if (params?.type && params.type !== 'all') q.set('type', params.type);
  if (params?.search?.trim()) q.set('search', params.search.trim());
  const s = q.toString();
  return s ? `?${s}` : '';
}

export async function fetchBlacklist(params?: BlacklistListParams): Promise<BlacklistRecord[]> {
  const { blacklist } = await apiFetch<{ blacklist: BlacklistRecord[] }>(
    `/api/blacklist${buildBlacklistQuery(params)}`,
  );
  return blacklist;
}

export async function createBlacklistRecord(body: BlacklistCreateBody): Promise<BlacklistRecord> {
  const { record } = await apiFetch<{ record: BlacklistRecord }>('/api/blacklist', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return record;
}

export async function removeBlacklistById(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/blacklist/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function removeTenantFromBlacklist(tenantId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/blacklist/tenant/${encodeURIComponent(tenantId)}`, {
    method: 'DELETE',
  });
}

export async function removeBrokerFromBlacklist(partnerAgencyId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/blacklist/broker/${encodeURIComponent(partnerAgencyId)}`, {
    method: 'DELETE',
  });
}
