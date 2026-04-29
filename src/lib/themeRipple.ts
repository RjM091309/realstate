export type ThemeRippleMode = 'dark' | 'light';

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
}

function getViewportMaxRadius(x: number, y: number): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dx = Math.max(x, w - x);
  const dy = Math.max(y, h - y);
  return Math.ceil(Math.hypot(dx, dy));
}

export async function animateThemeRippleFromElement(opts: {
  mode: ThemeRippleMode;
  element: HTMLElement | null;
  /** Called during the animation once the overlay covers content. */
  onApplyTheme: () => void;
}) {
  if (!opts.element || prefersReducedMotion()) {
    opts.onApplyTheme();
    return;
  }

  const rect = opts.element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const maxR = getViewportMaxRadius(x, y);

  const overlay = document.createElement('div');
  overlay.setAttribute('data-theme-ripple', 'true');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  // Keep the ripple behind app UI (see #root z-index in index.css).
  overlay.style.zIndex = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.background =
    opts.mode === 'dark'
      ? 'radial-gradient(1200px 600px at 10% 10%, rgba(79,70,229,0.25), transparent 60%), #020617'
      : 'radial-gradient(900px 500px at 10% 10%, rgba(79,70,229,0.12), transparent 60%), #f8fafc';
  overlay.style.clipPath = `circle(0px at ${x}px ${y}px)`;

  // Insert before the app root so it behaves like background.
  const root = document.getElementById('root');
  if (root?.parentNode) root.parentNode.insertBefore(overlay, root);
  else document.body.appendChild(overlay);

  const expand = overlay.animate(
    [
      { clipPath: `circle(0px at ${x}px ${y}px)` },
      { clipPath: `circle(${maxR}px at ${x}px ${y}px)` },
    ],
    { duration: 520, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' },
  );

  // Apply theme when the overlay mostly covers the viewport.
  window.setTimeout(() => {
    opts.onApplyTheme();
  }, 180);

  await expand.finished.catch(() => {});

  const fade = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 140,
    easing: 'ease-out',
    fill: 'forwards',
  });
  await fade.finished.catch(() => {});

  overlay.remove();
}

