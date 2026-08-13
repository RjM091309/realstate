/** Official barangay list for Santo Tomas (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const SANTO_TOMAS_CITY_NAME = 'Santo Tomas';

export const SANTO_TOMAS_CITY_BARANGAYS: readonly string[] = [
  'Moras De La Paz',
  'Poblacion',
  'San Bartolome',
  'San Matias',
  'San Vicente',
  'Santo Rosario',
  'Sapa',
] as const;

export function isSantoTomasCity(name: string): boolean {
  // Match "Santo Tomas" and the PSGC form "Sto. Tomas" / "Sto Tomas".
  return /^(santo\s*tomas|sto\.?\s*tomas)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Santo Tomas (any casing). */
export function resolveSantoTomasCityKey(
  locationKeys: Iterable<string>,
  fallback = SANTO_TOMAS_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isSantoTomasCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Santo Tomas barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedSantoTomasCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveSantoTomasCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of SANTO_TOMAS_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
