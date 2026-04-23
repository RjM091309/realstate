import { apiFetch } from '@/lib/api';
import type { InvoiceRow } from '@/types';

export type InvoiceCreateBody = {
  billingPeriodStart: string; // YYYY-MM-DD
  billingPeriodEnd: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  baseAmount: number;
  otherCharges: number;
  discountAmount: number;
  status?: InvoiceRow['status']; // default draft
};

export async function fetchContractInvoices(contractId: string): Promise<InvoiceRow[]> {
  const { invoices } = await apiFetch<{ invoices: InvoiceRow[] }>(`/api/invoices/contracts/${encodeURIComponent(contractId)}`);
  return invoices;
}

export async function fetchInvoice(id: string): Promise<InvoiceRow> {
  const { invoice } = await apiFetch<{ invoice: InvoiceRow }>(`/api/invoices/${encodeURIComponent(id)}`);
  return invoice;
}

export async function createContractInvoice(contractId: string, body: InvoiceCreateBody): Promise<InvoiceRow> {
  const { invoice } = await apiFetch<{ invoice: InvoiceRow }>(`/api/invoices/contracts/${encodeURIComponent(contractId)}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return invoice;
}

export async function patchInvoice(id: string, body: { status: InvoiceRow['status'] }): Promise<InvoiceRow> {
  const { invoice } = await apiFetch<{ invoice: InvoiceRow }>(`/api/invoices/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return invoice;
}

