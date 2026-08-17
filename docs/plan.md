# atproto-foodwiki — Plan

Build a **multi-user food-focused outliner client** on AT Protocol, using the Bulleted (`app.bulleted.*`) lexicons, the `@atcute` TypeScript packages, and HappyView as the AppView/database (Railway). Public posts by default; HappyView **Spaces** for permissioned data (backlog).

## Decisions (locked)

1. **Recipe storage:** `exchange.recipe` — backlog. Core FoodWiki is free-text outliner style using Bulleted lexicons; other lexicons get embedded over time.
2. **Permissioned data:** HappyView Spaces (stored in our HappyView instance) — backlog. Ship fully public posts first.
3. **Deploy:** Railway (user has account).
4. **Account:** `foodwiki.bmann.ca` (PDS `https://shimeji.us-east.host.bsky.network`, DID `did:plc:kwclrfytscd4udqzmsv42rj3`). Multi-user: a specialized client for bulleted.app focused on food.
5. **Repo:** public GitHub repo named `atproto-foodwiki` under the user's account (Boris Mann / bmann).

## Architecture

```
Browser (garden web app, TypeScript, @atcute)
  │  OAuth via atproto (PDS = shimeji…)
  ▼
HappyView AppView (Railway)     ← service identity did:web, PUBLIC_URL, OAuth
  • indexes public app.bulleted.* records (Jetstream + backfill)
  • serves Bulleted XRPC endpoints (getOutline, listRecords, …)
  • Spaces (com.atproto.space.*) for permissioned data (backlog)
  • Lua scripts for custom queries; permissions per user
  ▼
Users' PDS (first: foodwiki.bmann.ca on shimeji.us-east.host.bsky.network)
  └─ app.bulleted.node/outline/note/… records (the garden's source of truth)
```

## Phases

### Phase 0 — Bootstrap (current)
- npm workspaces monorepo, TypeScript strict, vitest, git
- Node 24 (installed via nodeenv)
- GitHub repo `atproto-foodwiki` (public)

### Phase 1 — Lexicons & types
- Curate Bulleted lexicons from Lexicon Garden (MCP available), `validate_lexicon` via MCP
- Generate TypeScript types with `@atcute/lex-cli`; commit generated `lexicons.ts`
- Mini client (read + write) using `@atcute/client`

### Phase 2 — HappyView instance (Railway)
- Deploy HappyView on Railway (one-click with Postgres)
- Configure PUBLIC_URL (tld), SESSION_SECRET, TOKEN_ENCRYPTION_KEY; service identity
- First login = super user; enable Spaces (backlog, but turn on flag now so it's ready)
- Add Bulleted collections; backfill

### Phase 3 — OAuth + login
- `@atcute/oauth-node-client` (server) + `@atcute/oauth-browser-client` (browser)
- scopes: `transition:generic` + `include:app.bulleted.authFull` (+ `appAccess` for writes)
- Multi-user: any atproto identity can sign in; their repo is their garden

### Phase 4 — Digital garden web app
- Reads: `GET /xrpc/app.bulleted.getOutline` (public)
- Writes: `com.atproto.repo.createRecord`/`putRecord`/`deleteRecord` for `app.bulleted.node` (+note/outline)
- Views: garden home, recipe pages (node + note), collections (Recipe List, Pantry, Stores…), tag/index pages
- HappyView Lua for custom queries

### Phase 5 — Permissioned data (backlog)
- HappyView Spaces: `com.atproto.simplespace.*` + `com.atproto.space.*`, membership, per-user repos
- Public and permissioned data cleanly separated

### Phase 6 — Port foodwiki.bmann.ca (backlog)
- Static TiddlyWiki export → outline nodes
- Migration script (atcute), dry-run, batch create

### Phase 7 — Structured recipes (backlog)
- `exchange.recipe` records, embed into garden

## Open items
- Node/OAuth session strategy (browser public client vs confidential + @atcute/oauth-cab)
- OAuth scopes finalization (permission sets vs transition:generic)
- HappyView instance URL/name
- Blob media (images in outlines) — later

## Current status (as of 2026-08-16)

### Deployed
- **HappyView (production)**: https://happyview-atproto-foodwiki-production.up.railway.app (Railway, v2.13.0 via our `deploy/happyview/Dockerfile`). Health OK, dashboard OK, Postgres. **Web app (production)**: https://web-production-eb82d.up.railway.app (Vite+React SPA, nginx).
- **Version note**: dashboard shows "0.1.0" — that's HappyView's internal version string; the release is v2.13.0. Not a problem.
- **Admin / super user**: `bmann.ca` (`did:plc:2cxgdrgtsmrbqnjkwyplmp43`), logged in via dashboard. **API key**: `hv_fc5ea2be45df401269e8e7776645f556` (created in Dashboard → Access → API Keys). Key scopes: full admin for provisioning.
- **Service identity**: `foodwiki.bmann.ca` (`did:plc:kwclrfytscd4udqzmsv42rj3`), mode `attach_account`, setup complete. This account represents the appview.
- **Web app domain (BACKLOG)**: `foodwiki.bmann.ca` will be the app domain (custom domain on Railway later). It's also the appview's service identity account (see above).

### Lexicons provisioned (all `source: network` — auto-update from bulleted.app)
- Record: `app.bulleted.node`, `app.bulleted.outline`, `app.bulleted.note`, `app.bulleted.mirror`, `app.bulleted.comment`, `app.bulleted.commentPolicy`
- Query: `app.bulleted.getOutline` (target_collection `app.bulleted.node`)
- Permission sets: `app.bulleted.authFull`, `app.bulleted.appAccess` (present on network via Lexicon Garden; added manually if needed for OAuth scopes)
- `getOutline` responds publicly and is fully live — bmann.ca's 10-node outline + the Bulleted publisher's 75-node outline render in the web app
- **Backfill**: ✅ **network-wide backfill completed** (2026-08-16): 61 repos, 685 `app.bulleted.*` records, 0 errors. Jetstream now live-indexes new records. Trigger new backfills via `POST /admin/backfill` (empty body = all collections/all repos).

### Settings
- `feature.spaces_enabled=true` (HappyView Spaces for permissioned data — backlog, but flag on)
- `space_cid_backfill_completed_at` set (space plumbing already migrated)

### Repo
- GitHub: https://github.com/bmann/atproto-foodwiki (public, main). All merges via PR; branch protection: `typecheck-build` CI required, linear history, no force-push/delete. (Reviews off for solo; re-enable with collaborators.)
- Monorepo: `packages/lexicons` (Bulleted schemas + generated atcute types), `packages/core` (@atcute client: getOutline, reads), `packages/web` (Vite+React SPA: public reads, OAuth login, bullet + outline writes), `deploy/happyview` (Dockerfile mirror + compose + README + railway.json), `deploy/web` (nginx SPA Dockerfile + railway.json + README), `scripts/` (provisioner, upstream drift check, PUBLIC_URL guard), `.github/workflows/` (happyview.yml drift check, check.yml typecheck/build), `FEATURES.md` (product spec + backlog).
- Railway config-as-code: `deploy/happyview/railway.json` + `deploy/web/railway.json` (schema-validated; builder DOCKERFILE + dockerfilePath). Auto-deploys on git commit; PR preview environments enabled.
- Local dev instance also runs HappyView in Docker (SQLite) at port 3000 (`docker compose -f deploy/happyview/docker-compose.dev.yml up -d`); PUBLIC_URL=127.0.0.1:3000 for dev; real OAuth requires public URL (Railway).
- **CRITICAL**: `PUBLIC_URL` must be a full absolute URL with scheme (e.g. `https://happyview-atproto-foodwiki-production.up.railway.app`), no trailing slash/path, or HappyView panics at boot with `ClientMetadata(InvalidClientId)`. Guard: `scripts/validate-public-url.mjs`.

### Known gaps / next (Phase 4+)
- Web app (Phase 4): reads via `getOutline`, writes via OAuth + `com.atproto.repo.*` to user PDS. Food-focused outliner UI.
- OAuth for the *web app*: need a public client_id + redirect on the app domain (foodwiki.bmann.ca later; for now dev via loopback or Railway app URL).
- **FoodWiki root feature** (spec in `FEATURES.md`): user picks whole-account vs a root bullet as their FoodWiki; backend already supports both (`app.bulleted.outline` rkey `self` vs subtree-at-root); chooser UI is planned.
- Web app Dockerfile (`deploy/web/`), nginx SPA, branch/PR deploy docs (`deploy/web/README.md`) — deploy to Railway is next.
- Import from **https://github.com/bmann/twgroceries** (live TiddlyWiki source of https://foodwiki.bmann.ca static export) into the bulleted outliner. Repo accessible via our GitHub PAT. **(backlog)**
- Structured recipes via `exchange.recipe` (backlog).
- Port foodwiki.bmann.ca static TiddlyWiki content (backlog).
- HappyView Spaces permissioned data (backlog; flag already enabled).
- `foodwiki.bmann.ca` is the appview/service-identity account (mode `attach_account`); the food garden content will live under user accounts (e.g. bmann.ca) or a dedicated food account later.

