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
   - **HappyView** → *New Service → Deploy from GitHub repo*, source =
     `bmann/atproto-foodwiki`. Railway reads `deploy/happyview/railway.json`
     (schema at `https://railway.com/railway.schema.json`), which sets
     `builder = DOCKERFILE` and `dockerfilePath = deploy/happyview/Dockerfile`
     (pinned to upstream v2.13.0).

2. **Environment variables** on the HappyView service. **Most important: `PUBLIC_URL` must be exactly `https://<host>` (scheme included, no trailing slash, no path).** A schemeless URL (e.g. `happyview.up.railway.app`) makes HappyView panic at boot with `ClientMetadata(InvalidClientId)` (it builds `{PUBLIC_URL}/oauth-client-metadata.json` as the OAuth client_id, which must parse as a URL). Run `PUBLIC_URL=... node scripts/validate-public-url.mjs` to check.

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `postgres://…` from the Railway Postgres service |
   | `PUBLIC_URL` | `https://<your-service>.up.railway.app` — **must be a full absolute URL with scheme, no trailing slash, no path**. Missing `https://` causes boot panic `ClientMetadata(InvalidClientId)` |
   | `SESSION_SECRET` | `openssl rand -base64 48` (≥32 bytes) |
   | `PORT` | `3000` |
   | `RELAY_URL` | `https://relay1.us-east.bsky.network` (optional) |
   | `TOKEN_ENCRYPTION_KEY` | `openssl rand -base64 32` (recommended) |

3. **First login = super user.** Open the dashboard, sign in with
   `foodwiki.bmann.ca` → that account becomes super user.

4. **Add lexicons + enable Spaces** (once you have an admin session/API key):

   ```bash
   HAPPYVIEW_URL=https://<your-service>.up.railway.app \
   HAPPYVIEW_API_KEY=hv_... \
   node scripts/provision-happyview.mjs
   ```
   Or add manually in the dashboard (Dashboard → Lexicons → Add Lexicon →
   Network, by NSID).

### Branch & PR deploys

`main` is protected on GitHub (requires the `check` workflow + one review), and
Railway auto-deploys `main`. To preview branches/PRs:

1. In Railway, open the HappyView service → **Settings → Environments** →
   **Add environment → Branch** (e.g. `staging`).
2. Enable **PR environments** (Railway GitHub App) so each pull request gets its
   own preview URL; the app's `railway.json` uses `deploy/happyview/Dockerfile`
   for every environment.
3. Per-branch envs inherit prod variables; override `PUBLIC_URL` to the preview
   service URL (absolute, no trailing slash — see the gotcha above) so OAuth
   works on the preview too.
   - Record: `app.bulleted.node`, `app.bulleted.outline`, `app.bulleted.note`,
     `app.bulleted.mirror`, `app.bulleted.comment`, `app.bulleted.commentPolicy`
     (backfill ON)
   - Query: `app.bulleted.getOutline` (target `app.bulleted.node`)
   - Permission sets: `app.bulleted.authFull`, `app.bulleted.appAccess`
   - (Optional) admin: `app.bulleted.admin.*`

   HappyView resolves network lexicons from bulleted.app's `_lexicon.bulleted.app`
   TXT → DID → PDS automatically.

5. **Enable Spaces** (backlog but turn on now): the provisioner sets
   `feature.spaces_enabled=true`; or Dashboard → Settings.

## Local dev

```bash
docker compose -f deploy/happyview/docker-compose.dev.yml up --build -d
# dashboard at http://127.0.0.1:3000
# sign in once with foodwiki.bmann.ca → super user; then:
HAPPYVIEW_URL=http://127.0.0.1:3000 HAPPYVIEW_API_KEY=hv_... node scripts/provision-happyview.mjs
```

## Keep in sync

`scripts/check-happyview-upstream.mjs` (CI: `.github/workflows/happyview.yml`)
verifies `deploy/happyview/Dockerfile` tracks upstream pinned ref. To bump:
`HAPPYVIEW_REF=v2.13.x node scripts/check-happyview-upstream.mjs`.
