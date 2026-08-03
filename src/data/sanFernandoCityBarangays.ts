/** Requested barangay list for City of San Fernando (Pampanga). */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SAN_FERNANDO_CITY_NAME = 'San Fernando';

export const SAN_FERNANDO_CITY_BARANGAYS: readonly string[] = [
  'Sindalan',
  'Telabastagan',
  'Dolores',
  'Lourdes',
  'Bulaon',
  'Calulut',
  'San Jose',
  'Baliti',
  'Del Pilar',
  'Maimpis',
] as const;

export function isSanFernandoCity(name: string): boolean {
  const trimmed = normalizeLocationAliasLabel(name);
  // Match "San Fernando", "SanFernando", "San Fernando City", etc.
  return /^(san\s*fernando)(\s*city)?$/i.test(trimmed);
}

/** Find existing location key that matches San Fernando (any casing). */
export function resolveSanFernandoCityKey(
  locationKeys: Iterable<string>,
  fallback = SAN_FERNANDO_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSanFernandoCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge San Fernando barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSanFernandoCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSanFernandoCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SAN_FERNANDO_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
