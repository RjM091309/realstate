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
