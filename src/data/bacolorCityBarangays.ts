/** Requested barangay list for Bacolor (Pampanga). */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const BACOLOR_CITY_NAME = 'Bacolor';

export const BACOLOR_CITY_BARANGAYS: readonly string[] = [
  'Cabalantian',
  'San Vicente',
  'Cabetican',
  'Cabambangan',
  'Calibutbut',
  'Macabacle',
  'San Antonio',
  'Santa Barbara',
  'Parulog',
  'Potrero',
] as const;

export function isBacolorCity(name: string): boolean {
  return /^(bacolor)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Bacolor (any casing). */
export function resolveBacolorCityKey(
  locationKeys: Iterable<string>,
  fallback = BACOLOR_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isBacolorCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Bacolor barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedBacolorCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveBacolorCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of BACOLOR_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
