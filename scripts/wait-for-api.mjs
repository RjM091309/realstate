/**
 * Block until Express /api/health responds so Vite does not proxy
 * /api/auth/session before the API has finished schema boot.
 */
const port = Number(process.env.API_PORT ?? 2550);
const url = `http://127.0.0.1:${port}/api/health`;
const timeoutMs = Number(process.env.WAIT_FOR_API_MS ?? 60_000);
const intervalMs = 400;
const started = Date.now();

async function ready() {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

while (Date.now() - started < timeoutMs) {
  if (await ready()) {
    console.log(`[wait-for-api] ${url} OK (${Date.now() - started}ms)`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, intervalMs));
}

console.error(`[wait-for-api] timed out after ${timeoutMs}ms waiting for ${url}`);
process.exit(1);
