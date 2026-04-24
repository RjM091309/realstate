import { apiFetch, getAuthHeaders } from '@/lib/api';
import type { Tenant } from '@/types';

async function tryParseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string' &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  return fallback;
}

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
  nationality?: string;
  birthDate?: string;
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
    const err = await tryParseJson(res);
    const msg = readApiErrorMessage(err, res.statusText || `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const { tenant } = (await res.json()) as { tenant: Tenant };
  return tenant;
}

export async function uploadTenantLeaseContract(
  tenantId: string,
  file: File,
  opts?: { title?: string; portalVisible?: boolean },
): Promise<{ filePath: string }> {
  const form = new FormData();
  form.append('file', file);
  if (opts?.title) form.append('title', opts.title);
  form.append('portalVisible', opts?.portalVisible === false ? '0' : '1');

  const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}/lease-contract`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: form,
  });

  if (!res.ok) {
    const err = await tryParseJson(res);
    const msg = readApiErrorMessage(err, res.statusText || `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const data = (await res.json()) as { ok: boolean; filePath: string };
  return { filePath: data.filePath };
}

export async function fetchTenantLeaseContract(tenantId: string): Promise<{ filePath: string; title?: string }> {
  const res = await apiFetch<{ filePath: string; title?: string }>(`/api/tenants/${encodeURIComponent(tenantId)}/lease-contract`);
  return res;
}
