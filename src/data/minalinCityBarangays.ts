/** Official barangay list for Minalin (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const MINALIN_CITY_NAME = 'Minalin';

export const MINALIN_CITY_BARANGAYS: readonly string[] = [
  'Bulac',
  'Dawe',
  'Lourdes',
  'Maniango',
  'San Francisco 1st',
  'San Francisco 2nd',
  'San Isidro',
  'San Nicolas',
  'San Pedro',
  'Saplad',
  'Sta. Catalina',
  'Sta. Maria',
  'Sta. Rita',
  'Sto. Domingo',
  'Sto. Rosario',
] as const;

export function isMinalinCity(name: string): boolean {
  return /^(minalin)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Minalin (any casing). */
export function resolveMinalinCityKey(
  locationKeys: Iterable<string>,
  fallback = MINALIN_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isMinalinCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Minalin barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedMinalinCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveMinalinCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of MINALIN_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
