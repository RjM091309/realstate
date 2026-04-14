
## Run Locally

**Prerequisites:** Node.js, MySQL (or MariaDB) with the `realstate` database imported from `database/realstate_init.sql`.

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and set `DATABASE_*` (and optional `GEMINI_API_KEY`). The API listens on `API_PORT` (default `3001`); Vite proxies `/api` to it.
3. Start the UI and API together: `npm run dev`  
   - App (Vite): `http://localhost:5173`  
   - API: `http://localhost:3001` (proxied as `/api` from the app)  
   - Sign in with seeded users, e.g. `admin` / `admin123` or `manager1` / `admin123`
4. Optional: `GET http://localhost:5173/api/health` should return `{"ok":true,"database":true}` when MySQL is reachable.

If you see `EADDRINUSE`, another process is using the port: stop the old `npm run dev` terminal, or change `API_PORT` in `.env` and restart.
