import { apiFetch } from '@/lib/api';

export type SystemThemeMode = 'dark' | 'light';

export async function setSystemTheme(mode: SystemThemeMode): Promise<void> {
  await apiFetch<{ ok: boolean; mode: SystemThemeMode }>('/api/system/theme', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
