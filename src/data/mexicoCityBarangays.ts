/** Official barangay list for Mexico (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const MEXICO_CITY_NAME = 'Mexico';

export const MEXICO_CITY_BARANGAYS: readonly string[] = [
  'Acli',
  'Anao',
  'Balas',
  'Buenavista',
  'Camuning',
  'Cawayan',
  'Concepcion',
  'Culubasa',
  'Divisoria',
  'Dolores',
  'Eden',
  'Gandus',
  'Lagundi',
  'Laput',
  'Laug',
  'Masamat',
  'Masangsang',
  'Nueva Victoria',
  'Pandacaqui',
  'Pangatlan',
  'Panipuan',
  'Parian',
  'Sabanilla',
  'San Antonio',
  'San Carlos',
  'San Jose Malino',
  'San Jose Matulid',
  'San Juan',
  'San Lorenzo',
  'San Miguel',
  'San Nicolas',
  'San Pablo',
  'San Patricio',
  'San Rafael',
  'San Roque',
  'San Vicente',
  'Santa Cruz',
  'Santa Maria',
  'Santo Domingo',
  'Santo Rosario',
  'Sapang Maisac',
  'Suclaban',
  'Tangle',
] as const;

export function isMexicoCity(name: string): boolean {
  return /^(mexico)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Mexico (any casing). */
export function resolveMexicoCityKey(
  locationKeys: Iterable<string>,
  fallback = MEXICO_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isMexicoCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Mexico barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedMexicoCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveMexicoCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of MEXICO_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
