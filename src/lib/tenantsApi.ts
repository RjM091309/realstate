import { apiFetch } from '@/lib/api';
import type { Tenant } from '@/types';

export type TenantWriteBody = {
  name: string;
  email: string;
  phone: string;
  idType: string;
  idNumber: string;
  idExpiry: string;
  idImageUrl?: string;
  kycVerified: boolean;
  isBlacklisted: boolean;
  blacklistReason?: string;
};

export async function fetchTenants(): Promise<Tenant[]> {
  const { tenants } = await apiFetch<{ tenants: Tenant[] }>('/api/tenants');
  return tenants;
}

export async function createTenant(body: TenantWriteBody): Promise<Tenant> {
  const { tenant } = await apiFetch<{ tenant: Tenant }>('/api/tenants', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return tenant;
}

export async function updateTenant(id: string, body: TenantWriteBody): Promise<Tenant> {
  const { tenant } = await apiFetch<{ tenant: Tenant }>(`/api/tenants/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return tenant;
}

export async function deleteTenant(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/tenants/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
