/** Official barangay list for San Luis (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SAN_LUIS_CITY_NAME = 'San Luis';

export const SAN_LUIS_CITY_BARANGAYS: readonly string[] = [
  'San Agustin',
  'San Carlos',
  'San Isidro',
  'San Jose',
  'San Juan',
  'San Nicolas',
  'San Roque',
  'San Sebastian',
  'Santa Catalina',
  'Santa Cruz Pambilog',
  'Santa Cruz Poblacion',
  'Santa Lucia',
  'Santa Monica',
  'Santa Rita',
  'Santo Niño',
  'Santo Rosario',
  'Santo Tomas',
] as const;

export function isSanLuisCity(name: string): boolean {
  return /^(san\s*luis)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches San Luis (any casing). */
export function resolveSanLuisCityKey(
  locationKeys: Iterable<string>,
  fallback = SAN_LUIS_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSanLuisCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge San Luis barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSanLuisCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSanLuisCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SAN_LUIS_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
