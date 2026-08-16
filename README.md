# atproto-foodwiki

FoodWiki: a personal digital garden for food & recipes, built on AT Protocol.

- **Data**: free-text outliner style using the [Bulleted](https://bulleted.app) lexicons (`app.bulleted.*`), stored in the author's atproto repo (public by default; HappyView **Spaces** for permissioned data in the backlog).
- **Lexicons**: `app.bulleted.node`, `note`, `outline`, `mirror`, `comment`, `commentPolicy`, `getOutline` + `authFull`/`appAccess` permission sets. (`exchange.recipe` for structured recipes — backlog.)
- **Backend**: [HappyView](https://happyview.dev) AppView instance (Railway) as database + index + XRPC server.
- **Client**: TypeScript, `@atcute/*` packages.

## Status

Phase 0 — scaffolding (in progress).

- [ ] Phase 0: monorepo scaffold + git
- [ ] Phase 1: lexicons & generated types (Lexicon Garden → atcute `lex-cli`)
- [ ] Phase 2: HappyView instance (Railway) + backfill
- [ ] Phase 3: OAuth + login (atcute)
- [ ] Phase 4: digital garden web app
- [ ] Phase 5: permissioned data via HappyView Spaces (backlog)
- [ ] Phase 6: port foodwiki.bmann.ca (backlog)
- [ ] Phase 7: structured recipes via `exchange.recipe` (backlog)

See `Plan` in this repo / `docs/plan.md` for the full plan.