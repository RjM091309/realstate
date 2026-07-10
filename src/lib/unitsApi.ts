import { apiFetch } from '@/lib/api';
import type { Unit } from '@/types';

export type UnitWriteBody = {
  unitNumber: string;
  floor: string;
  tower: string;
  buildingName: string;
  commonAddress: string;
  legalAddress: string;
  type: Unit['type'];
  status: Unit['status'];
  area: Unit['area'];
  areaSqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  monthlyRate: number;
  photoDataUrl?: string | null;
  specialRemarks?: string;
  inventory: Unit['inventory'];
};

export async function fetchUnits(): Promise<Unit[]> {
  const { units } = await apiFetch<{ units: Unit[] }>('/api/units');
  return units;
}

export async function createUnit(body: UnitWriteBody): Promise<Unit> {
  const { unit } = await apiFetch<{ unit: Unit }>('/api/units', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return unit;
}

export async function updateUnit(id: string, body: UnitWriteBody): Promise<Unit> {
  const { unit } = await apiFetch<{ unit: Unit }>(`/api/units/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return unit;
}

export async function deleteUnit(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/units/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
