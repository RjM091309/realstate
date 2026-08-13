/** Official barangay list for Macabebe (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const MACABEBE_CITY_NAME = 'Macabebe';

export const MACABEBE_CITY_BARANGAYS: readonly string[] = [
  'Batasan',
  'Caduang Tete',
  'Candelaria',
  'Castuli',
  'Consuelo',
  'Dalayap',
  'Mataguiti',
  'San Esteban',
  'San Francisco',
  'San Gabriel',
  'San Isidro',
  'San Jose',
  'San Juan',
  'San Rafael',
  'San Roque',
  'San Vicente',
  'Saplad David',
  'Sta. Cruz',
  'Sta. Lutgarda',
  'Sta. Maria',
  'Sta. Rita',
  'Sto. Niño',
  'Sto. Rosario',
  'Tacasan',
  'Telacsan',
] as const;

export function isMacabebeCity(name: string): boolean {
  return /^(macabebe)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Macabebe (any casing). */
export function resolveMacabebeCityKey(
  locationKeys: Iterable<string>,
  fallback = MACABEBE_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isMacabebeCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Macabebe barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedMacabebeCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveMacabebeCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of MACABEBE_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
