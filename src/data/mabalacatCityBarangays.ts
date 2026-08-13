/** Official barangay list for Mabalacat (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const MABALACAT_CITY_NAME = 'Mabalacat';

export const MABALACAT_CITY_BARANGAYS: readonly string[] = [
  'Atlu-Bola',
  'Bical',
  'Bundagul',
  'Cacutud',
  'Calumpang',
  'Camachiles',
  'Dapdap',
  'Dau',
  'Dolores',
  'Duquit',
  'Lakandula',
  'Mabiga',
  'Macapagal Village',
  'Mamatitang',
  'Mangalit',
  'Marcos Village',
  'Mawaque',
  'Paralayunan',
  'Poblacion',
  'San Francisco',
  'San Joaquin',
  'Santa Ines',
  'Santa Maria',
  'Santo Rosario',
  'Sapang Balen',
  'Sapang Biabas',
  'Tabun',
] as const;

const MABALACAT_RE = /^mabalacat(\s*city)?$/i;

export function isMabalacatCity(name: string): boolean {
  return MABALACAT_RE.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Mabalacat (any casing / optional City). */
export function resolveMabalacatCityKey(
  locationKeys: Iterable<string>,
  fallback = MABALACAT_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isMabalacatCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Mabalacat barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedMabalacatCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveMabalacatCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of MABALACAT_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
