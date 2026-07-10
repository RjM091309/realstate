import { apiFetch, getAuthHeaders } from '@/lib/api';
import type {
  InspectionPhotoSection,
  InspectionWorkflowStep,
  UnitInspectionPayload,
} from '@/types';

const BASE = '/api/unit-inspections';

export async function fetchContractInspection(contractId: string): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/contracts/${encodeURIComponent(contractId)}`);
}

export async function startContractInspection(contractId: string): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/contracts/${encodeURIComponent(contractId)}/start`, {
    method: 'POST',
  });
}

export async function patchInspection(
  inspectionId: string,
  body: {
    workflowStep?: InspectionWorkflowStep;
    inspectorRemarks?: string;
    scheduledMoveIn?: string;
    status?: string;
  },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/${encodeURIComponent(inspectionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function patchChecklistItem(
  inspectionId: string,
  itemId: string,
  body: { result?: 'pending' | 'pass' | 'fail'; remarks?: string; photoDataUrl?: string },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(
    `${BASE}/${encodeURIComponent(inspectionId)}/checklist/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function patchInventoryItem(
  inspectionId: string,
  itemId: string,
  body: {
    conditionState?: 'pending' | 'good' | 'damaged' | 'missing';
    quantity?: number;
    remarks?: string;
  },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(
    `${BASE}/${encodeURIComponent(inspectionId)}/inventory/${encodeURIComponent(itemId)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
  );
}

export async function addInspectionPhoto(
  inspectionId: string,
  body: { section: InspectionPhotoSection; photoDataUrl: string; caption?: string },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/${encodeURIComponent(inspectionId)}/photos`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteInspectionPhoto(
  inspectionId: string,
  photoId: string,
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(
    `${BASE}/${encodeURIComponent(inspectionId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE' },
  );
}

export async function saveInspectionDraft(
  inspectionId: string,
  body?: { inspectorRemarks?: string; workflowStep?: InspectionWorkflowStep },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/${encodeURIComponent(inspectionId)}/save-draft`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function approveInspection(
  inspectionId: string,
  body?: { inspectorRemarks?: string },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/${encodeURIComponent(inspectionId)}/approve`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function failInspection(
  inspectionId: string,
  body?: { inspectorRemarks?: string },
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(`${BASE}/${encodeURIComponent(inspectionId)}/fail`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  });
}

export async function scheduleInspectionMoveIn(
  inspectionId: string,
  moveInDate: string,
): Promise<UnitInspectionPayload> {
  return apiFetch<UnitInspectionPayload>(
    `${BASE}/${encodeURIComponent(inspectionId)}/schedule-move-in`,
    { method: 'POST', body: JSON.stringify({ moveInDate }) },
  );
}

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

export async function downloadInspectionReportPdf(inspectionId: string, fileName: string): Promise<void> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(inspectionId)}/report.pdf?_=${Date.now()}`,
    {
      headers: getAuthHeaders(),
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    let message = 'Failed to download inspection report';
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
