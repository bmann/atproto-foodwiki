# HappyView deployment (Railway)

HappyView is the AppView backing atproto-foodwiki. It indexes Bulleted
(`app.bulleted.*`) records from the atproto network, serves XRPC endpoints
(`app.bulleted.getOutline`, etc.), and will host permissioned data via Spaces
(backlog).

We run HappyView **from source** (upstream `gamesgamesgamesgamesgames/happyview`
v2.13.0, which has its own multi-stage Dockerfile).

## Railway deploy

1. **Create a Railway project**. Add two services:
   - **PostgreSQL** (Railway plugin)
   - **HappyView** → *New Service → Dockerfile*, source = this repo
     (`deploy/happyview/Dockerfile`, pinned to upstream v2.13.0).

2. **Environment variables** on the HappyView service:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `postgres://…` from the Railway Postgres service |
   | `PUBLIC_URL` | `https://<your-service>.up.railway.app` (or custom domain) — required for OAuth |
   | `SESSION_SECRET` | `openssl rand -base64 48` (≥32 bytes) |
   | `PORT` | `3000` |
   | `RELAY_URL` | `https://relay1.us-east.bsky.network` (optional) |
   | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (recommended) |

3. **First login = super user.** Open the dashboard, sign in with
   `foodwiki.bmann.ca` → that account becomes super user.

4. **Add lexicons** (Dashboard → Lexicons → Add Lexicon):
   - Record: `app.bulleted.node`, `app.bulleted.outline`, `app.bulleted.note`,
     `app.bulleted.mirror`, `app.bulleted.comment`, `app.bulleted.commentPolicy`
     (backfill ON)
   - Query: `app.bulleted.getOutline` (target `app.bulleted.node`)
   - Permission sets: `app.bulleted.authFull`, `app.bulleted.appAccess`
   - (Optional) admin: `app.bulleted.admin.*`
   Use **Network** lookup by NSID — HappyView resolves from bulleted.app's
   `_lexicon.bulleted.app` TXT → DID → PDS.

5. **Enable Spaces** (backlog, but turn on now):
   Dashboard → Settings → `feature.spaces_enabled=true`.

## Local dev

```bash
docker compose -f deploy/happyview/docker-compose.dev.yml up --build
# dashboard at http://127.0.0.1:3000
```

## Keep in sync

`scripts/check-happyview-upstream.mjs` (run in CI via
`.github/workflows/happyview.yml`) verifies `deploy/happyview/Dockerfile` tracks
the upstream pinned ref. Bump the ref + Dockerfile together:
`HAPPYVIEW_REF=v2.13.x node scripts/check-happyview-upstream.mjs`.
