/** Official barangay list for Arayat (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const ARAYAT_CITY_NAME = 'Arayat';

export const ARAYAT_CITY_BARANGAYS: readonly string[] = [
  'Arenas',
  'Baliti',
  'Batasan',
  'Buensuceso',
  'Candating',
  'Cupang',
  'Gatiawin',
  'Guemasan',
  'Kaledian',
  'La Paz',
  'Lacmit',
  'Lacquios',
  'Mangga-Cacutud',
  'Mapalad',
  'Matamo',
  'Panlinlang',
  'Paralaya',
  'Plazang Luma',
  'Poblacion',
  'San Agustin Norte',
  'San Agustin Sur',
  'San Antonio',
  'San Jose Mesulo',
  'San Juan Bano',
  'San Mateo',
  'San Nicolas',
  'San Roque Bitas',
  'Santo Niño Tabuan',
  'Suclayin',
  'Telapayong',
] as const;

export function isArayatCity(name: string): boolean {
  return /^(arayat)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Arayat (any casing). */
export function resolveArayatCityKey(
  locationKeys: Iterable<string>,
  fallback = ARAYAT_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isArayatCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Arayat barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedArayatCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveArayatCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of ARAYAT_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
