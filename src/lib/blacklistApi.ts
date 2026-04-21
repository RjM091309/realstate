import { apiFetch } from '@/lib/api';

export type BlacklistRowDto = {
  id: string;
  branchId: string;
  entityType: 'tenant' | 'landlord';
  tenantId?: string;
  landlordId?: string;
  name: string;
  type: 'Tenant' | 'Landlord';
  reason: string;
  details?: string;
  taggedBy?: string;
  date: string;
};

export type BlacklistCreateBody = {
  entityType: 'tenant' | 'landlord';
  tenantId?: string;
  landlordId?: string;
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
