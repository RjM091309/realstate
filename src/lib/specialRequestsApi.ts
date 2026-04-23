import { apiFetch } from '@/lib/api';

export type SpecialRequestRow = {
  id: string;
  contractId: string;
  title: string;
  details: string;
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled' | string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchContractSpecialRequests(contractId: string): Promise<SpecialRequestRow[]> {
  const { requests } = await apiFetch<{ requests: SpecialRequestRow[] }>(
    `/api/special-requests/contracts/${encodeURIComponent(contractId)}`,
  );
  return requests;
}

export async function createContractSpecialRequest(
  contractId: string,
  body: { title: string; details: string },
): Promise<SpecialRequestRow[]> {
  const { requests } = await apiFetch<{ requests: SpecialRequestRow[] }>(
    `/api/special-requests/contracts/${encodeURIComponent(contractId)}`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return requests;
}

