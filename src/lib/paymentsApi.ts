import { apiFetch } from '@/lib/api';
import type { Payment } from '@/types';

export type PaymentWriteBody = {
  contractId: string;
  unitId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: Payment['status'];
};

export async function fetchPayments(): Promise<Payment[]> {
  const { payments } = await apiFetch<{ payments: Payment[] }>('/api/payments');
  return payments;
}

export async function createPayment(body: PaymentWriteBody): Promise<Payment> {
  const { payment } = await apiFetch<{ payment: Payment }>('/api/payments', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return payment;
}

export async function updatePayment(id: string, body: PaymentWriteBody): Promise<Payment> {
  const { payment } = await apiFetch<{ payment: Payment }>(`/api/payments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return payment;
}

export async function deletePayment(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

