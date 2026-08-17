import { apiFetch } from '@/lib/api';

export type ViewingStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type PropertyViewing = {
  id: string;
  unitId: string;
  unitLabel: string;
  buildingName: string;
  prospectName: string;
  prospectContact: string | null;
  scheduledAt: string; // 'yyyy-MM-dd HH:mm:ss'
  status: ViewingStatus;
  agentId: string | null;
  agentName: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PropertyViewingWriteBody = {
  unitId: string;
  prospectName: string;
  prospectContact?: string | null;
  scheduledAt: string;
  agentId?: string | null;
  notes?: string | null;
};

const BASE = '/api/property-viewings';

export async function fetchPropertyViewings(): Promise<PropertyViewing[]> {
  const { viewings } = await apiFetch<{ viewings: PropertyViewing[] }>(BASE);
  return viewings;
}

export async function createPropertyViewing(body: PropertyViewingWriteBody): Promise<PropertyViewing> {
  const { viewing } = await apiFetch<{ viewing: PropertyViewing }>(BASE, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return viewing;
}

export async function updatePropertyViewing(
  id: string,
  body: Partial<PropertyViewingWriteBody> & { status?: ViewingStatus },
): Promise<PropertyViewing> {
  const { viewing } = await apiFetch<{ viewing: PropertyViewing }>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return viewing;
}

export async function deletePropertyViewing(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
