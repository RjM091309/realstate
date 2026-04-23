import { apiFetch } from '@/lib/api';
import type { Landlord } from '@/types';

export type LandlordWriteBody = {
  fullName: string;
  mobileNo?: string;
  email?: string;
  govIdNo?: string;
};

export async function fetchLandlords(): Promise<Landlord[]> {
  const { landlords } = await apiFetch<{ landlords: Landlord[] }>('/api/landlords');
  return landlords;
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

