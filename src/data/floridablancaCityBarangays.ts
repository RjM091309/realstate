/** Official barangay list for Floridablanca (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const FLORIDABLANCA_CITY_NAME = 'Floridablanca';

export const FLORIDABLANCA_CITY_BARANGAYS: readonly string[] = [
  'Anon',
  'Apalit',
  'Basa Air Base',
  'Benedicto',
  'Bodega',
  'Cabangcalan',
  'Calantas',
  'Carmencita',
  'Consuelo',
  'Dampe',
  'Del Carmen',
  'Fortuna',
  'Gutad',
  'Mabical',
  'Maligaya',
  'Mawacat',
  'Nabuclod',
  'Pabanlag',
  'Paguiruan',
  'Palmayo',
  'Pandaguirig',
  'Poblacion',
  'San Antonio',
  'San Isidro',
  'San Jose',
  'San Nicolas',
  'San Pedro',
  'San Ramon',
  'San Roque',
  'Solib',
  'Sta. Monica',
  'Sto. Rosario',
  'Valdez',
] as const;

export function isFloridablancaCity(name: string): boolean {
  return /^(floridablanca)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Floridablanca (any casing). */
export function resolveFloridablancaCityKey(
  locationKeys: Iterable<string>,
  fallback = FLORIDABLANCA_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isFloridablancaCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Floridablanca barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedFloridablancaCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveFloridablancaCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of FLORIDABLANCA_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
