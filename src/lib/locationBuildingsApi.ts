import { apiFetch } from '@/lib/api';

export type LocationBuilding = {
  id: string;
  location: string;
  building: string;
  active: boolean;
};

export async function fetchLocationBuildings(location?: string): Promise<LocationBuilding[]> {
  const qs = location?.trim()
    ? `?location=${encodeURIComponent(location.trim())}`
    : '';
  const { buildings } = await apiFetch<{ buildings: LocationBuilding[] }>(
    `/api/location-buildings${qs}`,
  );
  return buildings ?? [];
}

export async function createLocationBuilding(
  location: string,
  building: string,
): Promise<LocationBuilding> {
  const { building: row } = await apiFetch<{ building: LocationBuilding }>(
    '/api/location-buildings',
    {
      method: 'POST',
      body: JSON.stringify({ location, building }),
    },
  );
  return row;
}

export async function renameLocationBuilding(
  id: string,
  building: string,
): Promise<LocationBuilding> {
  const { building: row } = await apiFetch<{ building: LocationBuilding }>(
    `/api/location-buildings/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ building }),
    },
  );
  return row;
}

/** Soft-delete barangay/building in managed DB table (+ related units/properties). */
export async function softDeleteLocationBuilding(
  location: string,
  building: string,
): Promise<void> {
  await apiFetch<{ ok: boolean }>('/api/location-buildings/soft-delete', {
    method: 'POST',
    body: JSON.stringify({ location, building }),
  });
}
