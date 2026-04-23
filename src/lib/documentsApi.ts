import { apiFetch } from '@/lib/api';
import type { DocumentTemplateRow, RepositoryDocumentRow } from '@/types';

export async function fetchDocumentTemplates(templateKey?: string): Promise<DocumentTemplateRow[]> {
  const qs = templateKey ? `?template_key=${encodeURIComponent(templateKey)}` : '';
  const { templates } = await apiFetch<{ templates: DocumentTemplateRow[] }>(`/api/documents/templates${qs}`);
  return templates;
}

export type TemplateUploadBody = {
  file: File;
  templateKey: string;
  title: string;
  isActive: boolean;
};

export async function uploadDocumentTemplate(body: TemplateUploadBody): Promise<DocumentTemplateRow[]> {
  const fd = new FormData();
  fd.append('file', body.file);
  fd.append('templateKey', body.templateKey);
  fd.append('title', body.title);
  fd.append('isActive', body.isActive ? '1' : '0');

  const { templates } = await apiFetch<{ templates: DocumentTemplateRow[] }>(`/api/documents/templates`, {
    method: 'POST',
    body: fd,
  });
  return templates;
}

export async function fetchContractRepositoryDocuments(contractId: string): Promise<RepositoryDocumentRow[]> {
  const { documents } = await apiFetch<{ documents: RepositoryDocumentRow[] }>(
    `/api/documents/contracts/${encodeURIComponent(contractId)}/repository`,
  );
  return documents;
}

export type RepositoryUploadBody = {
  file: File;
  docType: 'lease_contract' | 'invoice' | 'kyc' | 'receipt' | 'move_in_out' | 'other';
  title: string;
  portalVisible: boolean;
  tenantId?: string;
};

export async function uploadContractRepositoryDocument(
  contractId: string,
  body: RepositoryUploadBody,
): Promise<RepositoryDocumentRow[]> {
  const fd = new FormData();
  fd.append('file', body.file);
  fd.append('docType', body.docType);
  fd.append('title', body.title);
  fd.append('portalVisible', body.portalVisible ? '1' : '0');
  if (body.tenantId) fd.append('tenantId', body.tenantId);

  const { documents } = await apiFetch<{ documents: RepositoryDocumentRow[] }>(
    `/api/documents/contracts/${encodeURIComponent(contractId)}/repository`,
    {
      method: 'POST',
      body: fd,
    },
  );
  return documents;
}

