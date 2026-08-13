/**
 * Area list for Clark (Pampanga). Clark isn't an official PSA/PSGC
 * municipality, so unlike the other Pampanga data files this has no
 * authoritative barangay source — the named condo/apartment/dormitory
 * entries below are a community-mapped sample from OpenStreetMap, not an
 * exhaustive or verified registry.
 */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const CLARK_CITY_NAME = 'Clark';

export const CLARK_CITY_AREAS: readonly string[] = [
  'Clark Freeport Zone',
  'Clark Global City',
  'Mimosa',
  'Clark Center',
  'Airport Area',
  'CDC Area',
  'Avana Place II',
  'Bourbon Street',
  'Brooks Apartments',
  'COSMO A',
  "Eagle's Inn",
  'Escalade Dormitory',
  "Girl's Residence Hall",
  'Golf Ridge Private Estate',
  'Haeyoung Building',
  'HOME',
  'Horizon Towers',
  'Hot Spot Apartments',
  'Housing',
  'J&M Residence',
  'Kandi Palace',
  'Kandi Tower 3',
  'KCM Suites',
  'Ladies Dormitory',
  'Leticia Suites',
  'Marlyn Apartments',
  "Mojo's Homes",
  'Monterrace Lake',
  'NCC Apartments',
  'Oguri Apartment',
  'Omni Aviation Dormitories',
  'Opal Tower by Kandi',
  'Orlando Residences',
  'Paramount Executive (Kandi Realty)',
  'Ray Luisa Grand Terrace',
  "Rector's House",
  'Rishan Village',
  'Roncal Apartments',
  'The Manansala',
  'White Tower by Kandi',
] as const;

export function isClarkCity(name: string): boolean {
  const trimmed = normalizeLocationAliasLabel(name);
  // Match plain "Clark" or "Clark City" — not nested area names like "Clark Center".
  return /^(clark|clark\s+city)$/i.test(trimmed);
}

/** Find existing location key that matches Clark (any casing). */
export function resolveClarkCityKey(
  locationKeys: Iterable<string>,
  fallback = CLARK_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isClarkCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Clark areas into extraBuildings map.
 * Does not remove user-added areas; only fills missing names.
 */
export function seedClarkCityAreas(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveClarkCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const area of CLARK_CITY_AREAS) {
    const key = area.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, area);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
