import { apiFetch } from '@/lib/api';

export type BlacklistRowDto = {
  id: string;
  branchId: string;
  entityType: 'tenant' | 'landlord' | 'broker';
  tenantId?: string;
  landlordId?: string;
  partnerAgencyId?: string;
  name: string;
  type: 'Tenant' | 'Broker';
  reason: string;
  details?: string;
  taggedBy?: string;
  date: string;
};

export type BlacklistCreateBody = {
  entityType: 'tenant' | 'landlord' | 'broker';
  tenantId?: string;
  landlordId?: string;
  partnerAgencyId?: string;
  reason: string;
  details?: string;
};

export async function fetchBlacklist(): Promise<BlacklistRowDto[]> {
  const { blacklist } = await apiFetch<{ blacklist: BlacklistRowDto[] }>('/api/blacklist');
  return blacklist;
}

export async function createBlacklistRecord(body: BlacklistCreateBody): Promise<BlacklistRowDto> {
  const { record } = await apiFetch<{ record: BlacklistRowDto }>('/api/blacklist', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return record;
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
