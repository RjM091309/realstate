/** Official barangay list for San Simon (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SAN_SIMON_CITY_NAME = 'San Simon';

export const SAN_SIMON_CITY_BARANGAYS: readonly string[] = [
  'Concepcion',
  'De La Paz',
  'San Agustin',
  'San Isidro',
  'San Jose',
  'San Juan',
  'San Miguel',
  'San Nicolas',
  'San Pablo Libutad',
  'San Pablo Proper',
  'San Pedro',
  'Santa Cruz',
  'Santa Monica',
  'Santo Niño',
] as const;

export function isSanSimonCity(name: string): boolean {
  return /^(san\s*simon)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches San Simon (any casing). */
export function resolveSanSimonCityKey(
  locationKeys: Iterable<string>,
  fallback = SAN_SIMON_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSanSimonCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge San Simon barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSanSimonCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSanSimonCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SAN_SIMON_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
