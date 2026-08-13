/** Official barangay list for Apalit (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const APALIT_CITY_NAME = 'Apalit';

export const APALIT_CITY_BARANGAYS: readonly string[] = [
  'Balucuc',
  'Calantipe',
  'Cansinala',
  'Capalangan',
  'Colgante',
  'Paligui',
  'Sampaloc',
  'San Juan',
  'San Vicente',
  'Sucad',
  'Sulipan',
  'Tabuyuc',
] as const;

export function isApalitCity(name: string): boolean {
  return /^(apalit)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Apalit (any casing). */
export function resolveApalitCityKey(
  locationKeys: Iterable<string>,
  fallback = APALIT_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isApalitCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Apalit barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedApalitCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveApalitCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of APALIT_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
