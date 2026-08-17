# Handoff / Compaction Notes (read this first)

**Project**: atproto-foodwiki — a multi-user, food-focused digital garden / outliner client on AT Protocol (Bulleted `app.bulleted.*` lexicons, `@atcute/*` libs, HappyView AppView backend).
**Latest activity**: Phase 3 (OAuth + writes) and the FoodWiki root feature shipped & merged; updating notes before compaction. This doc is the source of truth to resume.

## Contract & key facts

### Infrastructure (Railway, public)
- **HappyView AppView (prod)**: `https://happyview-atproto-foodwiki-production.up.railway.app` — health 200, dashboard, Postgres, version string "0.1.0" == release v2.13.0 (expected; don't chase it).
- **Web app (prod)**: `https://web-production-eb82d.up.railway.app` — Vite+React SPA on nginx (port 80). **Auto-deploys on git commit (main). PR preview environments enabled.**
- **Admin API key**: `hv_fc5ea2be45df401269e8e7776645f556` (super-user bmann.ca). Store in env, never commit. Admin base: `<HappyView>/admin/...` with `Authorization: Bearer hv_...`.
- **Super user / admin account**: `bmann.ca` = `did:plc:2cxgdrgtsmrbqnjkwyplmp43` (PDS `https://morel.us-east.host.bsky.network`).
- **Service identity (appview account)**: `foodwiki.bmann.ca` = `did:plc:kwclrfytscd4udqzmsv42rj3`, mode `attach_account`, setup complete. Zero bulleted records (it's the appview, not content).
- **Custom domain backlog**: serve web app on `foodwiki.bmann.ca` (Railway later).

### OAuth (Phase 3, shipped & working)
- Web app is a **public** OAuth client registered on HappyView: `POST /admin/api-clients` name "FoodWiki web app (production)", `client_id_url` = `https://web-production-eb82d.up.railway.app/oauth-client-metadata.json`, redirect `https://web-production-eb82d.up.railway.app/oauth/callback`, `client_type: public`, scopes `atproto transition:generic include:app.bulleted.authFull`, `allowed_origins` = web origin.
- Client metadata served statically at `/oauth-client-metadata.json` (committed in `packages/web/public/`). `CLIENT_ID`/`REDIRECT_URI` derive from `window.location.origin` in `oauth.ts`. **If the web app domain changes, update `public/oauth-client-metadata.json` + re-register the HappyView client.**
- Stack: `@atcute/oauth-browser-client` — `configureOAuth` (LocalActorResolver w/ XrpcHandleResolver→public.api.bsky.app, CompositeDidDocumentResolver plc+web) → `createAuthorizationUrl` → bsky login → callback `finalizeAuthorization` (params may be in `hash` or `search`) → `new OAuthUserAgent(session)` used as `new Client({ handler: agent })` (TS needs cast; README-blessed).
- Writes: `client.call(ComAtprotoRepo*Record.mainSchema)` from `@atcute/atproto` (procedures use `input` not `data`), `repo` cast to `ActorIdentifier`. Bullet record: `app.bulleted.node` with `text, sortKey, createdAt` (required) + `parent/layout/display/completedAt/facets`.
- HappyView v2.13.0 `getOutline` returns RAW records shape `{records:[...]}` (rows: `uri,text,sortKey,parent?,layout?,completedAt?,facets?,$type`), NOT the annotated `#node` shape (`nodes`,`did`,`handle`,`outline`,`truncated`,`cid`,`rkey`,`childCount`) from the newer lexicon. Web app normalizes either shape (`packages/web/src/lib/outline-tree.ts`). Also `node` (zoom) param is IGNORED by HappyView — root scoping is done client-side (`subtreeRows`).

### FoodWiki root feature (shipped)
- Modes: whole-account (default) vs root-bullet. Stored in `app.bulleted.outline/self` record (`root` = at-uri of chosen bullet; absent = whole account). `app.bulleted.outline` key `self` = whole forest; other rkeys = subtree (we use `self`).
- Reads outline record PUBLICLY from the author PDS: `resolvePds(did)` via `https://plc.directory/<did>` (#atproto_pds) → `GET {pds}/xrpc/com.atproto.repo.getRecord?repo&collection=app.bulleted.outline&rkey=self` (400 = none). Title comes from there.
- Write: authed `putRecord` outline/self (see `packages/web/src/lib/root.ts`).
- UI: per-bullet "●" sets root (own bullets only), "clear root" banner button; shareable `/user/<did>/<rkey>/` subtree URLs.
- **Backlog (from user)**: inline editing (not prompt pop-ups); dedicated settings page for choosing/clearing the root bullet.

### Lexicons & backfill
- Provisioned on HappyView (all `source: network`): records `app.bulleted.node/outline/note/mirror/comment/commentPolicy`; query `getOutline`; permission sets `authFull/appAccess`.
- **Network backfill completed** (2026-08-16): 61 repos, 685 records, 0 errors. Jetstream live-indexes. Refresh via `POST /admin/backfill` (empty body = all).
- Settings: `feature.spaces_enabled=true` (Spaces backlog-ready).

### Repo & workflow
- GitHub `bmann/atproto-foodwiki` (public, main). **All merges via PR** (branch protection: `typecheck-build` CI required, linear history, no force/delete; reviews off for solo — re-enable when collaborators join).
- Monorepo: `packages/lexicons` (schemas + generated atcute types), `packages/core` (createClient/getOutline reads), `packages/web` (SPA: reads, OAuth, writes, root feature), `deploy/happyview` + `deploy/web` (Dockerfiles + railway.json + READMEs), `scripts/`, `.github/workflows/` (`check.yml` typecheck+build; `happyview.yml` upstream drift), `FEATURES.md` (product + backlog).
- Railway: `deploy/*/railway.json` (schema https://railway.com/railway.schema.json; builder DOCKERFILE + dockerfilePath). Auto-deploy on commit; PR preview envs on.

## Local dev
- `npm run dev -w @foodwiki/web` → :5173. `VITE_APPVIEW_URL` defaults to prod HappyView (override via `.env.local`). Reads fine locally; **OAuth only works on the deployed public web URL** (bsky must fetch client metadata; localhost not registered).
- HappyView local: `docker compose -f deploy/happyview/docker-compose.dev.yml up -d` → :3000 (SQLite).

## Known gotchas
- **`PUBLIC_URL` must be absolute with scheme, no trailing slash/path** or HappyView panics at boot `ClientMetadata(InvalidClientId)` (guard: `scripts/validate-public-url.mjs`).
- HappyView host-validation: requests to an unregistered host → HTTP 421 "Unknown host". `PUBLIC_URL` + `PUT /admin/domains` (or admin API) must match. (We hit this during the Railway domain rename.)
- Railway web service listens on container port **80** (nginx) — no `PORT` var. HappyView listens on **3000** (`PORT=3000`).
- CORS: HappyView reflects its registered domains; ensure new web origins are registered if the domain changes.
- Node 24; use `tsx` for TS scripts. Push via PR (not direct to main).

## Backlog (see FEATURES.md + docs/plan.md)
- [ ] Inline editing (no pop-ups). **[user-requested]**
- [ ] Dedicated settings page for root bullet. **[user-requested]**
- [ ] `exchange.recipe` structured recipes.
- [ ] Import from `github.com/bmann/twgroceries` (TiddlyWiki source of static foodwiki.bmann.ca). PAT access confirmed. App password will be provided when it's time.
- [ ] Images/media in outlines (blob upload + appview blob proxy).
- [ ] HappyView Spaces permissioned data (flag already enabled).
- [ ] `foodwiki.bmann.ca` custom domain on Railway.
- [ ] OAuth polish: refresh handling, multi-account switch, better session UI.

## Conventions
- Commits: local git config is Boris Mann / boris@bmannconsulting.com. Push: export `GH_TOKEN` (PAT) first; branch + PR (never direct-to-main).
- Type-check: `npx tsc -p packages/<pkg>/tsconfig.json --noEmit`. Regenerate lexicons: `npm run gen:all -w packages/lexicons`.
