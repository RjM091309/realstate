/** Official barangay list for Lubao (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const LUBAO_CITY_NAME = 'Lubao';

export const LUBAO_CITY_BARANGAYS: readonly string[] = [
  'Balantacan',
  'Bancal Pugad',
  'Bancal Sinubli',
  'Baruya',
  'Calangain',
  'Concepcion',
  'De La Paz',
  'Del Carmen',
  'Don Ignacio Dimson',
  'Lourdes',
  'Prado Siongco',
  'Remedios',
  'San Agustin',
  'San Antonio',
  'San Francisco',
  'San Isidro',
  'San Jose Apunan',
  'San Jose Gumi',
  'San Juan',
  'San Matias',
  'San Miguel',
  'San Nicolas 1st',
  'San Nicolas 2nd',
  'San Pablo 1st',
  'San Pablo 2nd',
  'San Pedro Palcarangan',
  'San Pedro Saug',
  'San Roque Arbol',
  'San Roque Dau',
  'San Vicente',
  'Santa Barbara',
  'Santa Catalina',
  'Santa Cruz',
  'Santa Lucia',
  'Santa Maria',
  'Santa Monica',
  'Santa Rita',
  'Santa Teresa 1st',
  'Santa Teresa 2nd',
  'Santiago',
  'Santo Cristo',
  'Santo Domingo',
  'Santo Niño',
  'Santo Tomas',
] as const;

export function isLubaoCity(name: string): boolean {
  return /^(lubao)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Lubao (any casing). */
export function resolveLubaoCityKey(
  locationKeys: Iterable<string>,
  fallback = LUBAO_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isLubaoCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Lubao barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedLubaoCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveLubaoCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of LUBAO_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
