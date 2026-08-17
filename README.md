# atproto-foodwiki

FoodWiki: a multi-user, food-focused digital garden on AT Protocol — your recipes,
groceries, and food notes as a living, linkable outline.

- **Data**: free-text outliner style using the [Bulleted](https://bulleted.app) lexicons
  (`app.bulleted.*`), stored in each author's atproto repo (public by default; HappyView
  **Spaces** for permissioned data — backlog).
- **Client**: TypeScript web app (`@foodwiki/web`), `@atcute/*` packages.
- **AppView**: [HappyView](https://happyview.dev) (Railway) — indexes `app.bulleted.*`
  from the network, serves public `getOutline`, admin UI.
- **Live**: <https://happyview-atproto-foodwiki-production.up.railway.app> (HappyView/dashboard) and
  the web app at `/user/<handle-or-did>/` (e.g. `/user/bmann.ca/`).

## Product

See **[FEATURES.md](FEATURES.md)** — the feature overview (what it is, what you can do
today, the "FoodWiki root" feature, roadmap, and backlog).

## Repo layout

| Path | What |
|---|---|
| `packages/lexicons` | Bulleted schemas (from Lexicon Garden) + generated atcute types |
| `packages/core` | atproto client (`getOutline` reads, etc.) |
| `packages/web` | Vite + React SPA (per-user outline viewer) |
| `deploy/happyview` | HappyView Dockerfile (Railway) + local compose + provisioner |
| `deploy/web` | Web app Dockerfile (nginx SPA) + deploy README (branch/PR envs) |
| `scripts/` | Provisioner, upstream drift check, PUBLIC_URL guard |
| `docs/plan.md` | Full plan + current status + backlog |

## Status

Phase 0–2 done: monorepo, lexicons + generated types, HappyView AppView live on Railway,
network-wide backfill of `app.bulleted.*`. Phase 4 in progress: web app reads outlines
per-user. Phase 3 (OAuth + login/writes) is next.

- [x] Phase 0: monorepo scaffold + git
- [x] Phase 1: lexicons & generated types (Lexicon Garden → atcute `lex-cli`)
- [x] Phase 2: HappyView instance (Railway) + network backfill
- [ ] Phase 3: OAuth + login (atcute) — *next*
- [ ] Phase 4: digital garden web app (read path done; writes come with Phase 3)
- [ ] Phase 5: permissioned data via HappyView Spaces (backlog)
- [ ] Phase 6: port foodwiki.bmann.ca (backlog)
- [ ] Phase 7: structured recipes via `exchange.recipe` (backlog)

## Deploy

See `deploy/happyview/README.md` and `deploy/web/README.md` for Railway setup, including
branch & PR preview environments.
