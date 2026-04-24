
## Run Locally

**Prerequisites:** Node.js, MySQL (or MariaDB) with the `realstate` database imported from `database/realstate_init.sql`.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `DATABASE_*` (and optional `GEMINI_API_KEY`). The API listens on `API_PORT` (default `2550` if unset; must match the value Vite proxies to). Without `.env`, MySQL defaults to `root` with no password and usually fails on Linux—use a real user/password as in `.env.example`.
3. Start the UI and API together: `npm run dev`  
   - App (Vite): `http://localhost:2551`
   - API: `http://localhost:2550` (proxied as `/api` from the app when `API_PORT=2550`)  
   - Sign in with seeded users, e.g. `admin` / `admin123` or `manager1` / `admin123`
4. Optional: `GET http://localhost:2551/api/health` should return `{"ok":true,"database":true}` when MySQL is reachable.

If you see `EADDRINUSE`, another process is using the port: stop the old `npm run dev` terminal, or change `API_PORT` in `.env` and restart.
