/** Official barangay list for Masantol (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const MASANTOL_CITY_NAME = 'Masantol';

export const MASANTOL_CITY_BARANGAYS: readonly string[] = [
  'Alauli',
  'Bagang',
  'Balibago',
  'Bebe Anac',
  'Bebe Matua',
  'Bulacus',
  'Cambasi',
  'Malauli',
  'Nigui',
  'Palimpe',
  'Puti',
  'Sagrada',
  'San Agustin',
  'San Isidro Anac',
  'San Isidro Matua',
  'San Nicolas',
  'San Pedro',
  'Sapang Kawayan',
  'Sta. Cruz',
  'Sta. Lucia Anac',
  'Sta. Lucia Matua',
  'Sta. Lucia Paguiba',
  'Sta. Lucia Wakas',
  'Sta. Monica',
  'Sto. Niño',
  'Sua',
] as const;

export function isMasantolCity(name: string): boolean {
  return /^(masantol)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Masantol (any casing). */
export function resolveMasantolCityKey(
  locationKeys: Iterable<string>,
  fallback = MASANTOL_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isMasantolCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Masantol barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedMasantolCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveMasantolCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of MASANTOL_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
