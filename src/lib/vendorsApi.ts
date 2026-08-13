import { apiFetch } from '@/lib/api';

export type VendorCategory =
  | 'plumbing'
  | 'electrical'
  | 'hvac'
  | 'carpentry'
  | 'painting'
  | 'pest_control'
  | 'cleaning'
  | 'appliance'
  | 'general'
  | 'other';

export type VendorRow = {
  id: string;
  name: string;
  category: VendorCategory | string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type VendorWriteBody = {
  name: string;
  category: VendorCategory;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
};

export async function fetchVendors(): Promise<VendorRow[]> {
  const { vendors } = await apiFetch<{ vendors: VendorRow[] }>('/api/vendors');
  return vendors;
}

export async function createVendor(body: VendorWriteBody): Promise<VendorRow> {
  const { vendor } = await apiFetch<{ vendor: VendorRow }>('/api/vendors', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return vendor;
}

export async function updateVendor(id: string, body: VendorWriteBody): Promise<VendorRow> {
  const { vendor } = await apiFetch<{ vendor: VendorRow }>(`/api/vendors/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return vendor;
}

export async function deleteVendor(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/vendors/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
