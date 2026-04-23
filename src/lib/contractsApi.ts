import { apiFetch } from '@/lib/api';
import type { Contract, ContractCollaborationRow, ContractTenantRow } from '@/types';

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

export async function fetchContractTenants(contractId: string): Promise<ContractTenantRow[]> {
  const { tenants } = await apiFetch<{ tenants: ContractTenantRow[] }>(
    `/api/contracts/${encodeURIComponent(contractId)}/tenants`,
  );
  return tenants;
}

export async function fetchContractCollaborations(contractId: string): Promise<ContractCollaborationRow[]> {
  const { collaborations } = await apiFetch<{ collaborations: ContractCollaborationRow[] }>(
    `/api/contracts/${encodeURIComponent(contractId)}/collaborations`,
  );
  return collaborations;
}

export type ContractDocumentDetails = {
  contract: Contract;
  unit: {
    id: string;
    unitNumber: string;
    floor: string;
    tower: string;
    buildingName: string;
    commonAddress: string;
    legalAddress: string;
  };
  tenant: { id: string; name: string; email: string; phone: string } | null;
  landlord: { id: string; fullName: string; mobileNo: string; email: string; govIdNo: string } | null;
};

export async function fetchContractDocumentDetails(contractId: string): Promise<ContractDocumentDetails> {
  return await apiFetch<ContractDocumentDetails>(`/api/contracts/${encodeURIComponent(contractId)}/document-details`);
}

export type ContractCollaborationInviteBody = {
  name?: string;
  email?: string;
  commissionTerms?: string;
  remarks?: string;
};

export async function inviteContractCollaborator(
  contractId: string,
  body: ContractCollaborationInviteBody,
): Promise<ContractCollaborationRow[]> {
  const { collaborations } = await apiFetch<{ collaborations: ContractCollaborationRow[] }>(
    `/api/contracts/${encodeURIComponent(contractId)}/collaborations`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return collaborations;
}

