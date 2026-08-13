/** Official barangay list for Porac (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const PORAC_CITY_NAME = 'Porac';

export const PORAC_CITY_BARANGAYS: readonly string[] = [
  'Babo Pangulo',
  'Babo Sacan',
  'Balubad',
  'Calzadang Bayu',
  'Camias',
  'Cangatba',
  'Diaz',
  'Dolores',
  'Inararo',
  'Jalung',
  'Mancatian',
  'Manibaug Libutad',
  'Manibaug Paralaya',
  'Manibaug Pasig',
  'Manuali',
  'Mitla Proper',
  'Palat',
  'Pias',
  'Pio',
  'Planas',
  'Poblacion',
  'Pulung Santol',
  'Salu',
  'San Jose Mitla',
  'Sapang Uwak',
  'Sepung Bulaon',
  'Sinura',
  'Sta. Cruz',
  'Villa Maria',
] as const;

export function isPoracCity(name: string): boolean {
  return /^(porac)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Porac (any casing). */
export function resolvePoracCityKey(
  locationKeys: Iterable<string>,
  fallback = PORAC_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isPoracCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Porac barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedPoracCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolvePoracCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of PORAC_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
