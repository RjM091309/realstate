/** Requested area list for Clark (Pampanga). */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const CLARK_CITY_NAME = 'Clark';

export const CLARK_CITY_AREAS: readonly string[] = [
  'Clark Freeport Zone',
  'Clark Global City',
  'Mimosa',
  'Clark Center',
  'Airport Area',
  'CDC Area',
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
