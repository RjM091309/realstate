import { apiFetch } from '@/lib/api';

export type SystemThemeMode = 'dark' | 'light';

export async function setSystemTheme(mode: SystemThemeMode): Promise<void> {
  // Server endpoint only supports Windows host theme integration.
  // On Linux/macOS dev, treat this as a no-op to avoid noisy 400 logs.
  if (typeof navigator !== 'undefined' && !/win/i.test(navigator.platform)) {
    return;
  }
  await apiFetch<{ ok: boolean; mode: SystemThemeMode }>('/api/system/theme', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
