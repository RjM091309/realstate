import { apiFetch } from '@/lib/api';

export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved' | 'cancelled';

export type MaintenanceRequestRow = {
  id: string;
  contractId: string;
  contractNo?: string;
  unitLabel?: string;
  buildingName?: string;
  tenantName?: string;
  requestSource?: string;
  title: string;
  details: string;
  status: MaintenanceStatus | string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Use MaintenanceRequestRow */
export type SpecialRequestRow = MaintenanceRequestRow;

export async function fetchMaintenanceRequests(): Promise<MaintenanceRequestRow[]> {
  const { requests } = await apiFetch<{ requests: MaintenanceRequestRow[] }>('/api/special-requests');
  return requests;
}

export async function updateMaintenanceRequestStatus(
  id: string,
  status: MaintenanceStatus,
): Promise<MaintenanceRequestRow> {
  const { request } = await apiFetch<{ request: MaintenanceRequestRow }>(
    `/api/special-requests/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    },
  );
  return request;
}

export async function fetchContractSpecialRequests(contractId: string): Promise<MaintenanceRequestRow[]> {
  const { requests } = await apiFetch<{ requests: MaintenanceRequestRow[] }>(
    `/api/special-requests/contracts/${encodeURIComponent(contractId)}`,
  );
  return requests;
}

export async function createContractSpecialRequest(
  contractId: string,
  body: { title: string; details: string },
): Promise<MaintenanceRequestRow[]> {
  const { requests } = await apiFetch<{ requests: MaintenanceRequestRow[] }>(
    `/api/special-requests/contracts/${encodeURIComponent(contractId)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return requests;
}
