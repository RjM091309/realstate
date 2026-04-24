const TOKEN_KEY = 'realstate_token';
const DEV_BYPASS_USER_ID_KEY = 'realstate_dev_user_id';

async function tryParseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function readApiErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'error' in payload &&
    typeof payload.error === 'string' &&
    payload.error.trim()
  ) {
    return payload.error;
  }
  return fallback;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function setDevBypassUserId(userId: number | null): void {
  if (userId == null) localStorage.removeItem(DEV_BYPASS_USER_ID_KEY);
  else localStorage.setItem(DEV_BYPASS_USER_ID_KEY, String(userId));
}

export function getAuthHeaders(initHeaders?: HeadersInit): Headers {
  const token = getToken();
  const headers = new Headers(initHeaders);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else {
    const devUserId = localStorage.getItem(DEV_BYPASS_USER_ID_KEY);
    if (devUserId) headers.set('x-dev-user-id', devUserId);
  }
  return headers;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = getAuthHeaders(init?.headers);
  headers.set('Accept', 'application/json');
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (init?.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (e) {
    const hint =
      ' If the API is not running, use `npm run dev` (API + Vite) or `npm run dev:api` (see API_PORT in `.env`).';
    throw new Error(e instanceof Error ? `${e.message}.${hint}` : `Request failed.${hint}`);
  }
  if (!res.ok) {
    const err = await tryParseJson(res);
    const msg = readApiErrorMessage(err, res.statusText || `HTTP ${res.status}`);
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
