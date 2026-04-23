import { apiFetch } from '@/lib/api';
import type { InventorySnapshotItemRow, InventorySnapshotRow } from '@/types';

export async function fetchContractInventorySnapshots(contractId: string): Promise<InventorySnapshotRow[]> {
  const { snapshots } = await apiFetch<{ snapshots: InventorySnapshotRow[] }>(
    `/api/inventory/contracts/${encodeURIComponent(contractId)}`,
  );
  return snapshots;
}

export async function fetchSnapshotItems(snapshotId: string): Promise<InventorySnapshotItemRow[]> {
  const { items } = await apiFetch<{ items: InventorySnapshotItemRow[] }>(
    `/api/inventory/snapshots/${encodeURIComponent(snapshotId)}/items`,
  );
  return items;
}

export type InventorySnapshotCreateBody = {
  contractId: string;
  snapshotType: InventorySnapshotRow['snapshotType'];
  inspectionDate: string; // YYYY-MM-DD
  remarks?: string;
};

export async function createInventorySnapshot(body: InventorySnapshotCreateBody): Promise<{ snapshotId: string }> {
  const res = await apiFetch<{ ok: boolean; snapshotId: string }>(`/api/inventory/snapshots`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { snapshotId: res.snapshotId };
}

export type InventorySnapshotItemCreateBody = {
  snapshotId: string;
  itemName: string;
  category?: string;
  quantity: number;
  conditionState: InventorySnapshotItemRow['conditionState'];
  notes?: string;
};

export async function createInventorySnapshotItem(body: InventorySnapshotItemCreateBody): Promise<{ itemId: string }> {
  const res = await apiFetch<{ ok: boolean; itemId: string }>(`/api/inventory/items`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { itemId: res.itemId };
}

export type InventorySnapshotPatchBody = {
  snapshotType: InventorySnapshotRow['snapshotType'];
  inspectionDate: string; // YYYY-MM-DD
  remarks?: string;
};

export async function patchInventorySnapshot(snapshotId: string, body: InventorySnapshotPatchBody): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/inventory/snapshots/${encodeURIComponent(snapshotId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteInventorySnapshot(snapshotId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/inventory/snapshots/${encodeURIComponent(snapshotId)}`, {
    method: 'DELETE',
  });
}

export type InventorySnapshotItemPatchBody = {
  itemName: string;
  category?: string;
  quantity: number;
  conditionState: InventorySnapshotItemRow['conditionState'];
  notes?: string;
};

export async function patchInventorySnapshotItem(itemId: string, body: InventorySnapshotItemPatchBody): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/inventory/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteInventorySnapshotItem(itemId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/inventory/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  });
}

