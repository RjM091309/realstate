export type AppThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'realstate_theme_mode';
let themeTransitionTimer: number | undefined;

export function applyTheme(mode: AppThemeMode): void {
  const root = document.documentElement;
  root.classList.add('theme-transition');
  if (themeTransitionTimer != null) {
    window.clearTimeout(themeTransitionTimer);
  }
  root.classList.toggle('dark', mode === 'dark');
  localStorage.setItem(THEME_STORAGE_KEY, mode);
  themeTransitionTimer = window.setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 280);
}

export function getInitialTheme(): AppThemeMode {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  /** App default only — do not follow the browser/OS color scheme. */
  return 'light';
}
