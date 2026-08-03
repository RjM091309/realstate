export type FileMaintenanceCategory = {
  id: string;
  name: string;
  status: 'Active' | 'Inactive';
};

export const FILE_MAINTENANCE_STORAGE_KEY = 'realstate.fileMaintenanceCategories';

export const CORE_CATEGORY_IDS = ['location', 'building', 'units'] as const;
export type CoreCategoryId = (typeof CORE_CATEGORY_IDS)[number];

export const DEFAULT_FILE_MAINTENANCE_CATEGORIES: FileMaintenanceCategory[] = [
  { id: 'location', name: 'City', status: 'Active' },
  { id: 'building', name: 'Brgy', status: 'Active' },
  { id: 'units', name: 'Units', status: 'Active' },
];

function isCategory(value: unknown): value is FileMaintenanceCategory {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    (row.status === 'Active' || row.status === 'Inactive')
  );
}

export function loadFileMaintenanceCategories(): FileMaintenanceCategory[] {
  try {
    const raw = localStorage.getItem(FILE_MAINTENANCE_STORAGE_KEY);
    if (!raw) return [...DEFAULT_FILE_MAINTENANCE_CATEGORIES];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_FILE_MAINTENANCE_CATEGORIES];
    const rows = parsed.filter(isCategory).map((row) => ({
      id: row.id,
      name: row.name.trim() || row.id,
      status: row.status,
    }));
    if (rows.length === 0) return [...DEFAULT_FILE_MAINTENANCE_CATEGORIES];

    // Ensure core panels always exist (restore missing defaults).
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const def of DEFAULT_FILE_MAINTENANCE_CATEGORIES) {
      if (!byId.has(def.id)) byId.set(def.id, { ...def });
    }
    const core = CORE_CATEGORY_IDS.map((id) => byId.get(id)!);
    const extras = rows.filter((row) => !CORE_CATEGORY_IDS.includes(row.id as CoreCategoryId));
    return [...core, ...extras];
  } catch {
    return [...DEFAULT_FILE_MAINTENANCE_CATEGORIES];
  }
}

export function saveFileMaintenanceCategories(items: FileMaintenanceCategory[]): void {
  try {
    localStorage.setItem(FILE_MAINTENANCE_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getCoreCategoryName(
  items: FileMaintenanceCategory[],
  id: CoreCategoryId,
  fallback: string,
): string {
  const row = items.find((item) => item.id === id);
  const name = row?.name?.trim();
  return name || fallback;
}
