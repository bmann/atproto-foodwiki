# Handoff / Compaction Notes (read this first)

**Project**: atproto-foodwiki — a multi-user, food-focused outliner client on AT Protocol.
**Latest activity**: provisioning HappyView + writing notes; conversation will be compacted. This doc is the source of truth to resume.

## Contract & key facts

- **HappyView (prod)**: `https://happyview-atproto-foodwiki-production.up.railway.app`
  - Health `200`. Dashboard works. Postgres. Version string "0.1.0" == release v2.13.0 (expected).
  - **Admin API key**: `hv_fc5ea2be45df401269e8e7776645f556` (super-user bmann.ca). Store in env, never commit.
  - **Super user / admin account**: `bmann.ca` = `did:plc:2cxgdrgtsmrbqnjkwyplmp43`
  - **Service identity (appview account)**: `foodwiki.bmann.ca` = `did:plc:kwclrfytscd4udqzmsv42rj3`, mode `attach_account`, setup complete.
  - **Domain for web app (backlog)**: `foodwiki.bmann.ca` (add to Railway later as custom domain).
- **Lexicons provisioned** (all `source: network`, auto-update from bulleted.app's `_lexicon.bulleted.app` TXT):
  - Records: `app.bulleted.node`, `.outline`, `.note`, `.mirror`, `.comment`, `.commentPolicy`
  - Query: `app.bulleted.getOutline` (target `app.bulleted.node`)
  - `getOutline` works publicly → `{"records":[]}` (no bulleted records exist yet)
  - Backfill flag `false` (fine; no historical records; Jetstream live-indexes new)
- **Settings**: `feature.spaces_enabled=true` (HappyView Spaces ready for permissioned-data backlog). `space_cid_backfill_completed_at` set.
- **Repo**: https://github.com/bmann/atproto-foodwiki (public, main), npm workspaces monorepo:
  - `packages/lexicons` — bulleted schemas (from Lexicon Garden) + generated atcute types
  - `packages/core` — @atcute client (`createClient`, `getOutline`), reads
  - `deploy/happyview` — Dockerfile (clone upstream v2.13.0), compose (dev), README
  - `scripts/` — `provision-happyview.mjs`, `check-happyview-upstream.mjs`, `validate-public-url.mjs`
  - `.github/workflows/happyview.yml` — upstream drift check
- **Gotcha**: `PUBLIC_URL` must be a **full absolute URL with scheme** (e.g. `https://happyview-atproto-foodwiki-production.up.railway.app`), no trailing slash/path → else boot panic `ClientMetadata(InvalidClientId)`. Guard script: `scripts/validate-public-url.mjs`.

## Local dev

`docker compose -f deploy/happyview/docker-compose.dev.yml up -d` → HappyView on `:3000` (SQLite). OAuth only works with a public URL (real PDS) — use Railway for that; exe.dev proxy is private and can't be used for atproto OAuth (bsky can't fetch metadata).

## Next steps (Phase 4 — web app)

1. Scaffold a web app (Vite + React, or Next) in `packages/web` wearing `@atcute`.
2. Reads: `app.bulleted.getOutline` from HappyView (public).
3. Writes: OAuth (atcute `oauth-node-client`/`oauth-browser-client`) + `com.atproto.repo.createRecord/putRecord/deleteRecord` → user's PDS.
4. Food-focused outliner UI (recipes, pantry, etc.). Multi-user: any atproto account can sign in; their repo is their garden.
5. Deploy web app to Railway; set `foodwiki.bmann.ca` custom domain (backlog).
6. Backlog: `exchange.recipe` structured recipes; port foodwiki.bmann.ca static TiddlyWiki content; HappyView Spaces permissioned data; images/media.

## API key management

- Key lives only in env; do not commit. To rotate: Dashboard → Access → API Keys.
- Admin API base: `https://happyview-atproto-foodwiki-production.up.railway.app/admin/...` with `Authorization: Bearer hv_...`.

## Conventions

- Node 24 (nodeenv in ~/node). `tsx` to run TS. Type-check: `npx tsc -p packages/<pkg>/tsconfig.json --noEmit`.
- Regenerate lexicons: `npm run gen:all -w packages/lexicons` (fetch from Lexicon Garden → lex-cli generate).
- Commits: `git -c user.name="Boris Mann" -c user.email="boris@bmannconsulting.com" commit -m "..."` (repo has local config too).
- Push needs `GH_TOKEN` exported (PAT) since credential.helper uses env.
