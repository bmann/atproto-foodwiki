# FoodWiki — Feature Overview

FoodWiki is a **multi-user, food-focused digital garden** built on AT Protocol and the
[Bulleted](https://bulleted.app) outliner. Think of it as a place where your recipes,
groceries, notes, and food experiments live together as **one living, linkable outline** —
not locked in a document, but as records in your own atproto repository.

This file describes what FoodWiki is, what it does today, and what's planned. It's written
for end users as well as contributors.

---

## The core idea

> Your FoodWiki is your own outline of food knowledge. Every bullet is a record in your
> atproto repo; every outline is public and linkable by default.

- **Your data is yours.** Bullets are `app.bulleted.node` records in *your* repository,
  on your PDS. FoodWiki just reads and writes them.
- **Anything can link to anything.** A bullet has a stable AT-URI. Link a recipe, a note,
  a grocery item, a restaurant to remember — and link *between* them.
- **Multi-user by design.** Any atproto account can sign in. Each user has their own outline
  at their own URL: `/user/your-did/` or `/user/your-handle/`.

---

## Getting started

1. **Sign in** with any atproto account (Bluesky, PDS hosted elsewhere, etc.).
2. Visit **your FoodWiki URL**: `/user/<your-handle>/`.
3. Start adding bullets. That's it.

When you first sign in you'll have an empty outline — a blank slate to grow a garden.

---

## Choosing what your FoodWiki shows: the root

A plain atproto account may already contain lots of Bulleted records (a "forest" of notes,
todos, and outlines used for other things). A dedicated account will be *just* FoodWiki.
Both work — you choose how FoodWiki treats your account.

**This is the "FoodWiki root" feature:**

- **Whole-account mode (default).** FoodWiki shows your entire outline — every top-level
  bullet and its children — as your FoodWiki. Great if your account is dedicated to food
  (e.g. `foodwiki.bmann.ca`).
- **Root-bullet mode.** You pick a single bullet (or an outline with a `root`) and FoodWiki
  treats *that subtree* as your FoodWiki. The URL is
  `/user/<your-did>/<record-key>/` or `/user/<your-did>?node=<rkey>`.
  Great if your day-to-day account is also your outliner: tuck a bullet named "🍜 My
  FoodWiki" inside it, point FoodWiki at it, and everything else stays out of sight.

How it works under the hood: FoodWiki reads the `app.bulleted.outline` record for an
account (`rkey: self` = whole forest; any other rkey = subtree rooted at `root`). When no
outline record exists, or when the user hasn't chosen, FoodWiki shows the whole account
forest — the permissive, obvious default.

> **Status:** ✅ **shipped.** Sign in, open a bullet's “●” action to set it as your FoodWiki
> root (writes `app.bulleted.outline/self` with `root` = that bullet), or “clear root” to
> return to whole-account mode. Root views get their own shareable URL
> (`/user/<did>/<rkey>/`).

---

## What you can do today

### Whatever's in your outliner, rendered as a garden

- **Nested bullets** with headings (`h1/h2/h3`), bullets, todos, code blocks, quotes.
- **Sibling ordering** via `sortKey` — the app preserves your order.
- **Todos** — checked-off bullets show as completed.
- **Linkable, shareable URLs** per user.
- **Facets** (mentions, tags, links) render from the underlying records — nothing to
  re-enter.

### Living atproto data

- Reads go through the FoodWiki AppView (HappyView) serving `app.bulleted.getOutline` —
  a fast, indexed public read API.
- Records themselves live on your PDS, so your outline is portable and yours.

---

## Roadmap / planned

| Area | What's coming |
|---|---|
| ~~Inline editing~~ | ✅ **Shipped** — edit bullet text in place (textarea; Enter saves, Esc cancels), inline add-child row. No pop-ups anywhere. |
| ~~Settings page~~ | ✅ **Shipped** — ⚙ Garden Settings (owner-only): edit title/description, choose root bullet from a dropdown. |
| **Auth & writes** | ✅ **Shipped** — sign in with your atproto account (OAuth) and add/edit/delete bullets, toggle todos, set your FoodWiki root. Import via app password is a backlog batch operation. |
| ~~FoodWiki root chooser~~ | ✅ **Shipped** (set/clear root per bullet; shareable `/user/<did>/<rkey>/` URLs; whole-account default). **Polish backlog:** dedicated settings page for root choice. |
| **Transclusion / mirrors** | Render a bullet from another account inside your outline (`app.bulleted.mirror`), e.g. a shared pantry or collaborator's recipe. |
| **Structured recipes** | `exchange.recipe` records — typed ingredients, steps, servings — while staying inside the outline model. |
| **Images & media** | Upload to your PDS, preview via the AppView's blob proxy. |
| **Permissioned data (Spaces)** | Invite-only subtrees and private gardens via HappyView Spaces (feature flag already enabled). |
| **Content import** | Import from the existing static FoodWiki (the TiddlyWiki archive currently at foodwiki.bmann.ca). |
| **Custom domain** | Serve FoodWiki on `foodwiki.bmann.ca` with its own account as the appview identity. |

---

## Architecture (for contributors)

- **Monorepo**: `@foodwiki/lexicons` (Bulleted schemas + generated types),
  `@foodwiki/core` (atproto client, reads), `@foodwiki/web` (Vite + React app).
- **AppView**: HappyView (Railway) indexes `app.bulleted.*` from the network (relay +
  Jetstream), serves public `getOutline`, and exposes the admin API for provisioning.
- **Data model**: Bullets are `app.bulleted.node` records (text, sortKey, parent, layout,
  facets, createdAt, completedAt). Outlines are `app.bulleted.outline` records.
- **Deploys**: Railway. Each deploy (main + PRs) gets its own public URL; a web app
  service alongside the HappyView AppView service.

---

## Backlog (issue-worthy)

- [ ] FoodWiki root chooser UI (described above).
- [ ] Structured recipes via `exchange.recipe`.
- [ ] Blob upload + media preview.
- [ ] HappyView Spaces permissioned data (flag already on).
- [ ] Import from static TiddlyWiki archive (`github.com/bmann/twgroceries`).
- [ ] Add `foodwiki.bmann.ca` custom domain to Railway.
- [ ] Import with an app password (as a batch/backlog operation, not login).
