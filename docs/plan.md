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
