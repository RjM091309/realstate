/** Official barangay list for Santa Rita (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SANTA_RITA_CITY_NAME = 'Santa Rita';

export const SANTA_RITA_CITY_BARANGAYS: readonly string[] = [
  'Becuran',
  'Dila-dila',
  'San Agustin',
  'San Basilio',
  'San Isidro',
  'San Jose',
  'San Juan',
  'San Matias',
  'San Vicente',
  'Santa Monica',
] as const;

export function isSantaRitaCity(name: string): boolean {
  return /^(santa\s*rita)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Santa Rita (any casing). */
export function resolveSantaRitaCityKey(
  locationKeys: Iterable<string>,
  fallback = SANTA_RITA_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSantaRitaCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Santa Rita barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSantaRitaCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSantaRitaCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SANTA_RITA_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
