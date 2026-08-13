/** Official barangay list for Guagua (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const GUAGUA_CITY_NAME = 'Guagua';

export const GUAGUA_CITY_BARANGAYS: readonly string[] = [
  'Ascomo',
  'Bancal',
  'Jose Abad Santos',
  'Lambac',
  'Magsaysay',
  'Maquiapo',
  'Natividad',
  'Plaza Burgos',
  'Pulungmasle',
  'Rizal',
  'San Agustin',
  'San Antonio',
  'San Isidro',
  'San Jose',
  'San Juan',
  'San Juan Bautista',
  'San Juan Nepomuceno',
  'San Matias',
  'San Miguel',
  'San Nicolas 1st',
  'San Nicolas 2nd',
  'San Pablo',
  'San Pedro',
  'San Rafael',
  'San Roque',
  'San Vicente',
  'Santa Filomena',
  'Santa Ines',
  'Santa Ursula',
  'Santo Cristo',
  'Santo Niño',
] as const;

export function isGuaguaCity(name: string): boolean {
  return /^(guagua)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Guagua (any casing). */
export function resolveGuaguaCityKey(
  locationKeys: Iterable<string>,
  fallback = GUAGUA_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isGuaguaCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Guagua barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedGuaguaCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveGuaguaCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of GUAGUA_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
