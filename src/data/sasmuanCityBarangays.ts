/** Official barangay list for Sasmuan (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SASMUAN_CITY_NAME = 'Sasmuan';

export const SASMUAN_CITY_BARANGAYS: readonly string[] = [
  'Batang 1st',
  'Batang 2nd',
  'Mabuanbuan',
  'Malusac',
  'San Antonio',
  'San Nicolas 1st',
  'San Nicolas 2nd',
  'San Pedro',
  'Santa Monica',
  'Santo Tomas',
  'Sebitanan',
  'Sta. Lucia',
] as const;

export function isSasmuanCity(name: string): boolean {
  return /^(sasmuan)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Sasmuan (any casing). */
export function resolveSasmuanCityKey(
  locationKeys: Iterable<string>,
  fallback = SASMUAN_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSasmuanCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Sasmuan barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSasmuanCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSasmuanCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SASMUAN_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
