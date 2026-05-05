/**
 * Origin for Socket.IO (API server). Must not be hardcoded to localhost when the UI is
 * opened via LAN/public IP — the browser would connect to the user's machine instead.
 */
export function getSocketApiOrigin(): string {
  const explicit = String(import.meta.env.VITE_SOCKET_URL ?? '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const port = String(import.meta.env.VITE_API_PORT ?? '2550').trim() || '2550';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${port}`;
}
