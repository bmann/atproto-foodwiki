# FoodWiki web app — Railway deploy

The FoodWiki web app is a **static Vite + React SPA** served by nginx. It talks to the
HappyView AppView (`VITE_APPVIEW_URL`) at runtime in the browser.

## Repository → Railway

Everything deploys from the `bmann/atproto-foodwiki` repo on GitHub. Two Dockerfiles with
per-service `railway.json` (schema: `https://railway.com/railway.schema.json`):

| Service | `railway.json` | Dockerfile | What it is |
|---|---|---|---|
| `happyview` | `deploy/happyview/railway.json` | `deploy/happyview/Dockerfile` | AppView (indexes `app.bulleted.*`, serves `getOutline`, admin UI) |
| `web` | `deploy/web/railway.json` | `deploy/web/Dockerfile` | Public FoodWiki SPA (nginx, static) |

Each `railway.json` sets `builder = DOCKERFILE` + the Dockerfile path, healthcheck, and
restart policy — no Dockerfile path needed in the dashboard.

## Creating the `web` service on Railway

1. **New Project** (or reuse the existing `atproto-foodwiki` project).
2. **Add a Service → Deploy from GitHub repo** → `bmann/atproto-foodwiki`.
3. Railway reads `deploy/web/railway.json` and builds `deploy/web/Dockerfile`.
4. Set env vars on the web service:

   | Var | Value |
   |---|---|
   | `VITE_APPVIEW_URL` | `https://happyview-atproto-foodwiki-production.up.railway.app` (the HappyView service URL) |

   Vite env vars are baked **at build time** — redeploy after changing them.

5. Get your URL: `https://<web-service>.up.railway.app`. The SPA listens on port 80
   (nginx); no dedicated `PORT` mapping needed.

## Branch & PR deploys

GitHub `main` is protected: the **`check` workflow** (`typecheck-build`) must pass and a
review is required before merge. Railway can give you isolated environments per branch and
per PR:

### Per-branch environments

1. In each service → **Settings → Environments → Add environment → Branch** (e.g. `staging`).
2. Per-branch envs inherit production env vars. Override `VITE_APPVIEW_URL` if a preview
   needs a different AppView.
3. Each environment gets its own `<subdomain>.up.railway.app` URL.

### PR preview environments

1. Install/reconnect the **Railway GitHub App** for `bmann/atproto-foodwiki` (Repository
   access → Pull requests).
2. In each service → **Settings → Environments → PR environments: enable**.
3. For every pull request, Railway builds that branch and posts a **preview URL on the PR**
   (web + happyview side-by-side).
4. `railway.json`'s `environments.pr` block (if present) can tweak per-PR build/deploy.

> Branch protection means PR previews are also the *only* way to test a branch before it
> can touch `main`.

## Env cheat-sheet

| Service | Var | Example |
|---|---|---|
| happyview | `PUBLIC_URL` | `https://happyview-atproto-foodwiki-production.up.railway.app` (absolute, no trailing slash — else boot panic) |
| happyview | `DATABASE_URL` | Railway Postgres URL |
| happyview | `SESSION_SECRET` / `TOKEN_ENCRYPTION_KEY` | long random values (already in `.railway-secrets.env`) |
| happyview | `PORT` | `3000` |
| web | `VITE_APPVIEW_URL` | the happyview service URL |

## Local dev

```bash
npm run dev -w @foodwiki/web   # http://localhost:5173
```

`VITE_APPVIEW_URL` defaults to the production HappyView if unset; override with a `.env.local`.
