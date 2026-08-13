/** Official barangay list for Candaba (Pampanga), sourced from PSA PSGC. */
import { normalizeLocationAliasLabel } from '@/lib/locationNames';

export const CANDABA_CITY_NAME = 'Candaba';

export const CANDABA_CITY_BARANGAYS: readonly string[] = [
  'Bahay Pare',
  'Bambang',
  'Barangca',
  'Barit',
  'Buas',
  'Cuayang Bugtong',
  'Dalayap',
  'Dulong Ilog',
  'Gulap',
  'Lanang',
  'Lourdes',
  'Magumbali',
  'Mandasig',
  'Mandili',
  'Mangga',
  'Mapaniqui',
  'Paligui',
  'Pangclara',
  'Pansinao',
  'Paralaya',
  'Pasig',
  'Pescadores',
  'Pulong Gubat',
  'Pulong Palazan',
  'Salapungan',
  'San Agustin',
  'Santo Rosario',
  'Tagulod',
  'Talang',
  'Tenejero',
  'Vizal San Pablo',
  'Vizal Santo Cristo',
  'Vizal Santo Niño',
] as const;

export function isCandabaCity(name: string): boolean {
  return /^(candaba)(\s*city)?$/i.test(normalizeLocationAliasLabel(name));
}

/** Find existing location key that matches Candaba (any casing). */
export function resolveCandabaCityKey(
  locationKeys: Iterable<string>,
  fallback = CANDABA_CITY_NAME,
): string {
  for (const key of locationKeys) {
    if (isCandabaCity(key)) return key;
  }
  return fallback;
}

/**
 * Merge Candaba barangays into extraBuildings map.
 * Does not remove user-added barangays; only fills missing names.
 */
export function seedCandabaCityBarangays(
  extraBuildings: Record<string, string[]>,
  locationKeys: Iterable<string> = Object.keys(extraBuildings),
): Record<string, string[]> {
  const cityKey = resolveCandabaCityKey(locationKeys);
  const existing = extraBuildings[cityKey] ?? [];
  const byLower = new Map(existing.map((name) => [name.toLowerCase(), name]));

  for (const brgy of CANDABA_CITY_BARANGAYS) {
    const key = brgy.toLowerCase();
    if (!byLower.has(key)) byLower.set(key, brgy);
  }

  const merged = Array.from(byLower.values()).sort((a, b) => a.localeCompare(b));
  return { ...extraBuildings, [cityKey]: merged };
}
