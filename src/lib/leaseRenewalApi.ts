import { apiFetch, getAuthHeaders } from '@/lib/api';
import type {
  Contract,
  LeaseRenewalPayload,
  LeaseRenewalTerms,
  LeaseRenewalWorkflowStep,
} from '@/types';

const BASE = '/api/lease-renewals';

async function saveResponseAsFile(res: Response, fileName: string) {
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function fetchContractRenewal(contractId: string): Promise<LeaseRenewalPayload & { created?: boolean }> {
  return apiFetch(`${BASE}/contracts/${encodeURIComponent(contractId)}`);
}

export async function patchRenewal(
  renewalId: string,
  body: {
    workflowStep?: LeaseRenewalWorkflowStep;
    carryOverBalance?: boolean;
    carryOverReason?: string;
    internalNotes?: string;
    terms?: Partial<LeaseRenewalTerms>;
    managerApprovalNotes?: string;
  },
): Promise<LeaseRenewalPayload> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function saveRenewalDraft(renewalId: string): Promise<LeaseRenewalPayload> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}/save-draft`, { method: 'POST' });
}

export async function refreshRenewalBalance(renewalId: string): Promise<LeaseRenewalPayload> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}/refresh-balance`, { method: 'POST' });
}

export async function approveManagerRenewal(
  renewalId: string,
  body: { status?: 'approved' | 'rejected'; notes?: string },
): Promise<LeaseRenewalPayload> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}/manager-approval`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function recordTenantSignature(
  renewalId: string,
  body: { status?: 'signed' | 'rejected' },
): Promise<LeaseRenewalPayload> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}/tenant-signature`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function activateRenewal(
  renewalId: string,
  body?: { activationDate?: string },
): Promise<LeaseRenewalPayload & { contract: Contract; previousContractId: string }> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}/activate`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function declineRenewal(renewalId: string, reason?: string): Promise<LeaseRenewalPayload> {
  return apiFetch(`${BASE}/${encodeURIComponent(renewalId)}/decline`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function downloadRenewalDraftPdf(renewalId: string, fileName: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(renewalId)}/draft.pdf?_=${Date.now()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = 'Failed to download draft agreement';
    try {
      const payload = await res.json();
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  await saveResponseAsFile(res, fileName);
}

export async function downloadRenewalStatementPdf(renewalId: string, fileName: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(renewalId)}/statement.pdf?_=${Date.now()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = 'Failed to download statement';
    try {
      const payload = await res.json();
      if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
        message = payload.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  await saveResponseAsFile(res, fileName);
}

export async function openRenewalDraftPdf(renewalId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(renewalId)}/draft.pdf?_=${Date.now()}`, {
    headers: getAuthHeaders(),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to preview agreement');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
