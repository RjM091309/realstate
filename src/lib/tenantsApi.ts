import { apiFetch, getAuthHeaders } from '@/lib/api';
import type { Tenant } from '@/types';

export type PortalDocumentItem =
  | {
      id: string;
      kind: 'file';
      title: string;
      fileName: string;
      sizeLabel: string | null;
      downloadPath: string;
    }
  | {
      id: string;
      kind: 'preview';
      previewType: 'contract';
      contractId: string;
      title: string;
      fileName: string;
      sizeLabel: string | null;
    }
  | {
      id: string;
      kind: 'artifact';
      slug: string;
      title: string;
      fileName: string;
      sizeLabel: string | null;
    };

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

export async function fetchTenantById(id: string): Promise<Tenant> {
  const { tenant } = await apiFetch<{ tenant: Tenant }>(`/api/tenants/${encodeURIComponent(id)}`);
  return tenant;
}

export async function fetchTenantPortalDocuments(tenantId: string): Promise<PortalDocumentItem[]> {
  const { documents } = await apiFetch<{ documents: PortalDocumentItem[] }>(
    `/api/tenants/${encodeURIComponent(tenantId)}/portal-documents`,
  );
  return documents;
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

export async function uploadTenantKycDocument(tenantId: string, file: File): Promise<Tenant> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/kyc-document`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = typeof err?.error === 'string' ? err.error : res.statusText;
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const { tenant } = (await res.json()) as { tenant: Tenant };
  return tenant;
}
