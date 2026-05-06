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

export async function fetchContracts(options?: { archived?: boolean }): Promise<Contract[]> {
  const q = options?.archived ? '?archived=1' : '';
  const { contracts } = await apiFetch<{ contracts: Contract[] }>(`/api/contracts${q}`);
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

export type RenewContractBody = {
  startDate: string;
  endDate: string;
  monthlyRent: number;
  balanceHandling: 'carry_over' | 'require_payment';
  keepHistory: boolean;
  notes?: string | null;
};

export async function renewContract(contractId: string, body: RenewContractBody): Promise<Contract> {
  const { contract } = await apiFetch<{ contract: Contract }>(
    `/api/contracts/${encodeURIComponent(contractId)}/renew`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
  return contract;
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

/** POST invite and PATCH collaborator use the same field set */
export type ContractCollaboratorMutationBody = {
  name?: string;
  email?: string;
  commissionTerms?: string;
  remarks?: string;
};

export type ContractCollaborationInviteBody = ContractCollaboratorMutationBody;

export async function inviteContractCollaborator(
  contractId: string,
  body: ContractCollaboratorMutationBody,
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

export async function updateContractCollaborator(
  contractId: string,
  collabId: string,
  body: ContractCollaboratorMutationBody,
): Promise<{ collaborations: ContractCollaborationRow[]; tenants: ContractTenantRow[] }> {
  const result = await apiFetch<{ collaborations: ContractCollaborationRow[], tenants: ContractTenantRow[] }>(
    `/api/contracts/${encodeURIComponent(contractId)}/collaborations/${encodeURIComponent(collabId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
    },
  );
  return result;
}

