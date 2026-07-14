import { apiFetch } from '@/lib/api';
import type {
  Landlord,
  LandlordDetailPayload,
  LandlordDocumentRow,
  LandlordKycStatus,
  LandlordAccountStatus,
} from '@/types';

export type LandlordWriteBody = {
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  companyName?: string;
  mobileNo?: string;
  email?: string;
  birthDate?: string;
  address?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  govIdNo?: string;
  idType?: string;
  idNumber?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  tin?: string;
  proofOfAddressUrl?: string;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  gcash?: string;
  maya?: string;
  internalNotes?: string;
  kycStatus?: LandlordKycStatus;
  accountStatus?: LandlordAccountStatus;
  assignedAgentId?: string;
};

export type LandlordDocumentType =
  | 'government_id'
  | 'land_title'
  | 'tax_declaration'
  | 'lease_authorization'
  | 'business_permit'
  | 'proof_of_address'
  | 'other';

export async function fetchLandlords(): Promise<Landlord[]> {
  const { landlords } = await apiFetch<{ landlords: Landlord[] }>('/api/landlords');
  return landlords;
}

export async function fetchLandlordById(id: string): Promise<Landlord> {
  const { landlord } = await apiFetch<{ landlord: Landlord }>(`/api/landlords/${encodeURIComponent(id)}`);
  return landlord;
}

export async function fetchLandlordDetail(id: string): Promise<LandlordDetailPayload> {
  return apiFetch<LandlordDetailPayload>(`/api/landlords/${encodeURIComponent(id)}/detail`);
}

export async function createLandlord(body: LandlordWriteBody): Promise<Landlord> {
  const { landlord } = await apiFetch<{ landlord: Landlord }>('/api/landlords', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return landlord;
}

export async function updateLandlord(id: string, body: LandlordWriteBody): Promise<Landlord> {
  const { landlord } = await apiFetch<{ landlord: Landlord }>(`/api/landlords/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return landlord;
}

export async function deleteLandlord(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/landlords/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function uploadLandlordKycFile(
  landlordId: string,
  field: 'id_front' | 'id_back' | 'proof_of_address',
  file: File,
): Promise<Landlord> {
  const fd = new FormData();
  fd.append('file', file);
  const { landlord } = await apiFetch<{ landlord: Landlord }>(
    `/api/landlords/${encodeURIComponent(landlordId)}/kyc/${field}`,
    { method: 'POST', body: fd },
  );
  return landlord;
}

export async function uploadLandlordDocument(
  landlordId: string,
  body: { file: File; documentType: LandlordDocumentType; title: string },
): Promise<LandlordDocumentRow[]> {
  const fd = new FormData();
  fd.append('file', body.file);
  fd.append('documentType', body.documentType);
  fd.append('title', body.title);
  const { documents } = await apiFetch<{ documents: LandlordDocumentRow[] }>(
    `/api/landlords/${encodeURIComponent(landlordId)}/documents`,
    { method: 'POST', body: fd },
  );
  return documents;
}
