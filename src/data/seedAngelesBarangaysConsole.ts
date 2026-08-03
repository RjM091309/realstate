/**
 * Browser console helper for Angeles City barangays.
 *
 * In DevTools console:
 *   import { seedAngelesCityBarangaysIntoStorage } from '/src/data/seedAngelesBarangaysConsole.ts'
 *   seedAngelesCityBarangaysIntoStorage()
 * Then refresh the page.
 */
import {
  ANGELES_CITY_BARANGAYS,
  ANGELES_CITY_NAME,
  resolveAngelesCityKey,
  seedAngelesCityBarangays,
} from './angelesCityBarangays';

const EXTRA_LOCATIONS_KEY = 'realstate.extraLocations';
const EXTRA_BUILDINGS_KEY = 'realstate.extraBuildings';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Seed Angeles City + all barangays into localStorage. Returns the city key used. */
export function seedAngelesCityBarangaysIntoStorage(): {
  cityKey: string;
  barangayCount: number;
} {
  const locations = readJson<string[]>(EXTRA_LOCATIONS_KEY, []);
  const buildings = readJson<Record<string, string[]>>(EXTRA_BUILDINGS_KEY, {});

  const ensuredLocations = locations.some((x) => /^angeles\s*city$/i.test(String(x)))
    ? locations
    : [...locations, ANGELES_CITY_NAME];

  const nextBuildings = seedAngelesCityBarangays(buildings, [
    ...ensuredLocations,
    ...Object.keys(buildings),
  ]);
  const resolvedKey = resolveAngelesCityKey([...ensuredLocations, ...Object.keys(nextBuildings)]);

  localStorage.setItem(EXTRA_LOCATIONS_KEY, JSON.stringify(ensuredLocations));
  localStorage.setItem(EXTRA_BUILDINGS_KEY, JSON.stringify(nextBuildings));

  console.info(
    `[seed] ${nextBuildings[resolvedKey]?.length ?? 0} barangays under "${resolvedKey}"`,
    ANGELES_CITY_BARANGAYS,
  );

  return {
    cityKey: resolvedKey,
    barangayCount: nextBuildings[resolvedKey]?.length ?? ANGELES_CITY_BARANGAYS.length,
  };
}

export { ANGELES_CITY_BARANGAYS, ANGELES_CITY_NAME };
