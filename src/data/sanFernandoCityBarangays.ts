/** Official barangay list for City of San Fernando (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SAN_FERNANDO_CITY_NAME = 'San Fernando';

export const SAN_FERNANDO_CITY_BARANGAYS: readonly string[] = [
  'Alasas',
  'Baliti',
  'Bulaon',
  'Calulut',
  'Del Carmen',
  'Del Pilar',
  'Del Rosario',
  'Dela Paz Norte',
  'Dela Paz Sur',
  'Dolores',
  'Juliana',
  'Lara',
  'Lourdes',
  'Magliman',
  'Maimpis',
  'Malino',
  'Malpitic',
  'Pandaras',
  'Panipuan',
  'Pulung Bulu',
  'Quebiauan',
  'Saguin',
  'San Agustin',
  'San Felipe',
  'San Isidro',
  'San Jose',
  'San Juan',
  'San Nicolas',
  'San Pedro',
  'Santa Lucia',
  'Santa Teresita',
  'Santo Niño',
  'Santo Rosario',
  'Sindalan',
  'Telabastagan',
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
