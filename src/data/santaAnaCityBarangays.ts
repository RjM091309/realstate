/** Official barangay list for Santa Ana (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SANTA_ANA_CITY_NAME = 'Santa Ana';

export const SANTA_ANA_CITY_BARANGAYS: readonly string[] = [
  'San Agustin',
  'San Bartolome',
  'San Isidro',
  'San Joaquin',
  'San Jose',
  'San Juan',
  'San Nicolas',
  'San Pablo',
  'San Pedro',
  'San Roque',
  'Santa Lucia',
  'Santa Maria',
  'Santiago',
  'Santo Rosario',
] as const;

export function isSantaAnaCity(name: string): boolean {
  return /^(santa\s*ana)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Santa Ana (any casing). */
export function resolveSantaAnaCityKey(
  locationKeys: Iterable<string>,
  fallback = SANTA_ANA_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSantaAnaCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Santa Ana barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSantaAnaCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSantaAnaCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SANTA_ANA_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
