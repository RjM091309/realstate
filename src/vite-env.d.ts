/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TENANT_PORTAL_SUPPORT_EMAIL?: string;
  /** Full origin for Socket.IO, e.g. `https://api.example.com` (optional; default = page host + VITE_API_PORT). */
  readonly VITE_SOCKET_URL?: string;
  /** API port on the same host as the page (default `2550`). */
  readonly VITE_API_PORT?: string;
}
