/**
 * Shared location/city label helpers.
 */

/** Remove leading list numbers: "1. Clark", "3) Mabalacat", "#2 Angeles City". */
export function stripLocationOrdinalPrefix(name: string): string {
  let s = String(name ?? '').trim();
  if (!s) return s;
  for (let i = 0; i < 3; i += 1) {
    const next = s.replace(/^#?\d+[.)\]:\-]\s*/u, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** True when label already has a list ordinal ("1. Clark"). */
export function hasLocationOrdinalPrefix(name: string): boolean {
  return /^#?\d+[.)\]:\-]\s+\S/u.test(String(name ?? '').trim());
}

/**
 * Trim and collapse whitespace.
 * Preserves leading numbers so names like "1. Angeles City" can be saved.
 */
export function normalizeLocationLabel(name: string): string {
  return String(name ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Alias matching only — strips ordinals so "1. Angeles City" ≈ "Angeles City". */
export function normalizeLocationAliasLabel(name: string): string {
  return stripLocationOrdinalPrefix(normalizeLocationLabel(name));
}

/**
 * Ensure a city category name uses "N. Name".
 * Keeps an existing ordinal; otherwise assigns the next free number from `existingNames`.
 */
export function withLocationOrdinalPrefix(name: string, existingNames: string[] = []): string {
  const normalized = normalizeLocationLabel(name);
  if (!normalized) return normalized;
  if (hasLocationOrdinalPrefix(normalized)) return normalized;

  const base = stripLocationOrdinalPrefix(normalized) || normalized;
  const used = new Set<number>();
  for (const raw of existingNames) {
    const m = String(raw ?? '')
      .trim()
      .match(/^#?(\d+)[.)\]:\-]\s+/u);
    if (m) used.add(Number(m[1]) || 0);
  }
  let n = 1;
  while (used.has(n)) n += 1;
  return `${n}. ${base}`;
}
