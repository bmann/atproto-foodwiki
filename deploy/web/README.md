# FoodWiki web app — Railway deploy

The FoodWiki web app is a **static Vite + React SPA** served by nginx. It talks to the
HappyView AppView (`VITE_APPVIEW_URL`) at runtime in the browser.

## Repository → Railway

Everything deploys from the `bmann/atproto-foodwiki` repo on GitHub. Two Dockerfiles:

| Service | Dockerfile | What it is |
|---|---|---|
| `happyview` | `deploy/happyview/Dockerfile` | The AppView (Runtime, Postgres) — indexes `app.bulleted.*`, serves `getOutline`, admin UI |
| `web` | `deploy/web/Dockerfile` | The public FoodWiki SPA (nginx, static) |

## Creating the `web` service on Railway

1. **New Project** (or reuse the existing `atproto-foodwiki` project).
2. **Add a Service → Deploy from GitHub repo** → `bmann/atproto-foodwiki`.
3. Railway auto-detects both Dockerfiles. Add the **`web` Dockerfile** as the build for
   the service (in Settings → Source → Build command, or pick the Dockerfile when creating
   the service; set it to `deploy/web/Dockerfile`).
4. Set env vars on the web service:

   | Var | Value |
   |---|---|
   | `VITE_APPVIEW_URL` | `https://atproto-foodwiki-production.up.railway.app` (the HappyView service URL) |

   Note: Vite env vars are baked **at build time**. A redeploy re-runs the Dockerfile
   build with the current env, so changes take effect on deploy.

5. Generate a URL; it will be `https://<web-service>.up.railway.app`.

The SPA is served on port 80 (nginx) — no `PORT` mapping needed, Railway exposes the
container's `80`.

## Branch & PR deploys

Railway deploys **per git branch** and can create **PR environments** — isolate changes
before merging. Both services can use the same feature.

### Per-branch environments

1. In each service's **Settings → Environments**, click **Add environment → Branch**.
2. Choose a branch (e.g. `staging`), or enable **"Deploy on new PRs"** so every PR gets
   its own env.
3. Per-branch envs inherit the production env vars, so they work out of the box. Override
   per-branch as needed (e.g. a different `VITE_APPVIEW_URL` pointing at a preview
   HappyView).
4. Railway names them `<service>-<branch>` and gives each its own `<subdomain>.up.railway.app`.

### PR preview flow

- Push a branch → open a PR → Railway builds that PR's image and gives you a preview URL
  on the PR page (via the Railway GitHub App integration).
- Side-by-side HappyView + web previews let you test schema changes and UI together.
- Merge → production `main` redeploys atomically.

### Branch protection (recommended)

Keep `main` protected: require PR review, and let Railway PR environments be the
verification gate.

## Env cheat-sheet

| Service | Var | Example |
|---|---|---|
| happyview | `PUBLIC_URL` | `https://atproto-foodwiki-production.up.railway.app` (absolute, no trailing slash — else boot panic) |
| happyview | `DATABASE_URL` | Railway Postgres URL |
| happyview | `SESSION_SECRET` / `TOKEN_ENCRYPTION_KEY` | long random values (already in `.railway-secrets.env`) |
| happyview | `PORT` | `3000` |
| web | `VITE_APPVIEW_URL` | the happyview service URL |

## Local dev

```bash
npm run dev -w @foodwiki/web   # http://localhost:5173
```

`VITE_APPVIEW_URL` defaults to the production HappyView if unset; override to a local
instance (e.g. `http://127.0.0.1:3000`) with a `.env.local`.
