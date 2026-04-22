import { apiFetch } from '@/lib/api';
import type { BrokerAgency } from '@/types';

export type PartnerAgencyCreateBody = {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  nationality?: string;
  documentType?: string;
  documentNo?: string;
  expiryDate?: string;
  filePath?: string;
  kycVerified?: boolean;
  isBlacklisted?: boolean;
  blacklistReason?: string;
};

export async function fetchPartnerAgencies(): Promise<BrokerAgency[]> {
  const { agencies } = await apiFetch<{ agencies: BrokerAgency[] }>('/api/partner-agencies');
  return agencies;
}

export async function createPartnerAgency(body: PartnerAgencyCreateBody): Promise<BrokerAgency> {
  const { agency } = await apiFetch<{ agency: BrokerAgency }>('/api/partner-agencies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return agency;
}

export type PartnerAgencyPatchBody = Partial<PartnerAgencyCreateBody> & {
  active?: boolean;
};

export async function updatePartnerAgency(id: string, body: PartnerAgencyPatchBody): Promise<BrokerAgency> {
  const { agency } = await apiFetch<{ agency: BrokerAgency }>(`/api/partner-agencies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return agency;
}

export async function deletePartnerAgency(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/partner-agencies/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function uploadPartnerAgencyKycDocument(id: string, file: File): Promise<BrokerAgency> {
  const form = new FormData();
  form.append('file', file);
  const { agency } = await apiFetch<{ agency: BrokerAgency }>(
    `/api/partner-agencies/${encodeURIComponent(id)}/kyc-document`,
    {
      method: 'POST',
      body: form,
      headers: {}, // Let browser set multipart boundary
    } as RequestInit,
  );
  return agency;
}
