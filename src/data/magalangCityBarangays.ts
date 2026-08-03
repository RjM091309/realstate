/** Requested barangay list for Magalang (Pampanga). */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const MAGALANG_CITY_NAME = 'Magalang';

export const MAGALANG_CITY_BARANGAYS: readonly string[] = [
  'San Francisco',
  'San Nicolas I',
  'San Nicolas II',
  'Santa Cruz',
  'Dolores',
  'San Isidro',
  'Ayala',
  'San Jose',
  'Turu',
  'Camias',
] as const;

export function isMagalangCity(name: string): boolean {
  return /^(magalang)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Magalang (any casing). */
export function resolveMagalangCityKey(
  locationKeys: Iterable<string>,
  fallback = MAGALANG_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isMagalangCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Magalang barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedMagalangCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveMagalangCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of MAGALANG_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
