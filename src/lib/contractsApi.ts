import { apiFetch } from '@/lib/api';
import type { Contract } from '@/types';

export type ContractWriteBody = {
  unitId: string;
  tenantId: string;
  agentId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number;
  advanceRent: number;
  type: Contract['type'];
  status: Contract['status'];
  remarks?: string;
};

export async function fetchContracts(): Promise<Contract[]> {
  const { contracts } = await apiFetch<{ contracts: Contract[] }>('/api/contracts');
  return contracts;
}

export async function createContract(body: ContractWriteBody): Promise<Contract> {
  const { contract } = await apiFetch<{ contract: Contract }>('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return contract;
}

export async function updateContract(id: string, body: ContractWriteBody): Promise<Contract> {
  const { contract } = await apiFetch<{ contract: Contract }>(`/api/contracts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return contract;
}

export async function deleteContract(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/contracts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

