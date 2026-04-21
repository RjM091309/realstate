import { apiFetch } from '@/lib/api';
import type { BrokerAgency } from '@/types';

export type PartnerAgencyWriteBody = {
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
};

export async function fetchPartnerAgencies(): Promise<BrokerAgency[]> {
  const { agencies } = await apiFetch<{ agencies: BrokerAgency[] }>('/api/partner-agencies');
  return agencies;
}

export async function createPartnerAgency(body: PartnerAgencyWriteBody): Promise<BrokerAgency> {
  const { agency } = await apiFetch<{ agency: BrokerAgency }>('/api/partner-agencies', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return agency;
}

export async function updatePartnerAgency(id: string, body: PartnerAgencyWriteBody): Promise<BrokerAgency> {
  const { agency } = await apiFetch<{ agency: BrokerAgency }>(`/api/partner-agencies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return agency;
}

export async function deletePartnerAgency(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/partner-agencies/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
