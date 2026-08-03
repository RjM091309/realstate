import { apiFetch } from '@/lib/api';

export type LocationCity = {
  cityId: string;
  name: string;
  active: boolean;
};

export type LocationBrgy = {
  brgyId: string;
  cityId: string;
  cityName?: string;
  name: string;
  active: boolean;
};

export type LocationArea = {
  id: string;
  name: string;
  cityId: string | null;
  brgyId: string | null;
  cityName: string | null;
  brgyName: string | null;
  active: boolean;
};

export async function fetchCities(): Promise<LocationCity[]> {
  const { cities } = await apiFetch<{ cities: LocationCity[] }>('/api/locations/cities');
  return cities ?? [];
}

export async function createCity(name: string): Promise<LocationCity> {
  const { city } = await apiFetch<{ city: LocationCity }>('/api/locations/cities', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return city;
}

export async function renameCity(cityId: string, name: string): Promise<LocationCity> {
  const { city } = await apiFetch<{ city: LocationCity }>(
    `/api/locations/cities/${encodeURIComponent(cityId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );
  return city;
}

export async function deleteCity(cityId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/locations/cities/${encodeURIComponent(cityId)}`, {
    method: 'DELETE',
  });
}

export async function fetchBrgys(cityId?: string): Promise<LocationBrgy[]> {
  const qs = cityId?.trim() ? `?cityId=${encodeURIComponent(cityId.trim())}` : '';
  const { brgys } = await apiFetch<{ brgys: LocationBrgy[] }>(`/api/locations/brgys${qs}`);
  return brgys ?? [];
}

export async function createBrgy(cityId: string, name: string): Promise<LocationBrgy> {
  const { brgy } = await apiFetch<{ brgy: LocationBrgy }>('/api/locations/brgys', {
    method: 'POST',
    body: JSON.stringify({ cityId, name }),
  });
  return brgy;
}

export async function renameBrgy(brgyId: string, name: string): Promise<LocationBrgy> {
  const { brgy } = await apiFetch<{ brgy: LocationBrgy }>(
    `/api/locations/brgys/${encodeURIComponent(brgyId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    },
  );
  return brgy;
}

export async function deleteBrgy(brgyId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/locations/brgys/${encodeURIComponent(brgyId)}`, {
    method: 'DELETE',
  });
}

export async function fetchAreas(opts?: {
  cityId?: string;
  brgyId?: string;
}): Promise<LocationArea[]> {
  const params = new URLSearchParams();
  if (opts?.cityId?.trim()) params.set('cityId', opts.cityId.trim());
  if (opts?.brgyId?.trim()) params.set('brgyId', opts.brgyId.trim());
  const qs = params.toString() ? `?${params.toString()}` : '';
  const { areas } = await apiFetch<{ areas: LocationArea[] }>(`/api/locations/areas${qs}`);
  return areas ?? [];
}

export async function createArea(input: {
  name: string;
  cityId?: string | null;
  brgyId?: string | null;
}): Promise<LocationArea> {
  const { area } = await apiFetch<{ area: LocationArea }>('/api/locations/areas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return area;
}
