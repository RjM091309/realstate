/** Official / requested barangay list for Angeles City (Pampanga). */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const ANGELES_CITY_NAME = 'Angeles City';

export const ANGELES_CITY_BARANGAYS: readonly string[] = [
  'Agapito del Rosario',
  'Amsic',
  'Anunas',
  'Balibago',
  'Capaya',
  'Claro M. Recto',
  'Cuayan',
  'Cutcut',
  'Lourdes North West',
  'Lourdes Sur East',
  'Lourdes Sur',
  'Malabanias',
  'Margot',
  'Mining',
  'Ninoy Aquino',
  'Pampang',
  'Pandan',
  'Pulungbulu',
  'Pulung Cacutud',
  'Pulung Maragul',
  'Salapungan',
  'San Jose',
  'San Nicolas',
  'Sta. Teresita',
  'Sta. Trinidad',
  'Sto. Cristo',
  'Sto. Domingo',
  'Sto. Rosario',
  'Sapalibutad',
  'Sapa Libutad',
  'Tabun',
  'Virgen Delos Remedios',
] as const;

const ANGELES_CITY_RE = /^angeles(\s*city)?$/i;

/** True for "Angeles", "Angeles City", "1. Angeles City", any casing. */
export function isAngelesCity(name: string): boolean {
  return ANGELES_CITY_RE.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Angeles City (any casing). */
export function resolveAngelesCityKey(
  locationKeys: Iterable<string>,
  fallback = ANGELES_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isAngelesCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Angeles City barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedAngelesCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveAngelesCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of ANGELES_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
