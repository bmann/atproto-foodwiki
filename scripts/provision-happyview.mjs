// One-shot provisioner for a HappyView instance (dev or Railway).
// Requires: an authenticated session cookie (dashboard login) OR an admin API key
// (Settings → API Keys → create hv_* key with lexicons:create, settings:manage, backfill:run).
//
// Usage:
//   HAPPYVIEW_URL=http://127.0.0.1:3000 HAPPYVIEW_API_KEY=hv_... node scripts/provision-happyview.mjs
const BASE = process.env.HAPPYVIEW_URL || 'http://127.0.0.1:3000';
const KEY = process.env.HAPPYVIEW_API_KEY || process.env.HAPPYVIEW_ADMIN_TOKEN;
const headers = KEY ? { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text || 'no body'}`);
  return text ? JSON.parse(text) : null;
}

// Add Bulleted record lexicons (network lookup — HappyView resolves from bulleted.app's
// _lexicon.bulleted.app TXT record). backfill flag is set via /admin/lexicons on upload
// of network lexicons? admin/network-lexicons disables backfill=0; for backfill, upload
// via /admin/lexicons with the JSON + backfill:true instead.
const RECORD_LEXICONS = [
  'app.bulleted.node',
  'app.bulleted.outline',
  'app.bulleted.note',
  'app.bulleted.mirror',
  'app.bulleted.comment',
  'app.bulleted.commentPolicy',
];
const QUERY_LEXICONS = [{ nsid: 'app.bulleted.getOutline', target_collection: 'app.bulleted.node' }];

async function main() {
  const out = [];
  for (const nsid of RECORD_LEXICONS) {
    try {
      const r = await api('POST', '/admin/network-lexicons', { nsid });
      out.push(`ok record  ${nsid}${r ? '' : ' (added)'}`);
    } catch (e) {
      out.push(`err record ${nsid}: ${e.message}`);
    }
  }
  for (const q of QUERY_LEXICONS) {
    try {
      const r = await api('POST', '/admin/network-lexicons', q);
      out.push(`ok query   ${q.nsid}${r ? '' : ' (added)'}`);
    } catch (e) {
      out.push(`err query  ${q.nsid}: ${e.message}`);
    }
  }
  // Enable Spaces (backlog-ready)
  try {
    await api('PUT', '/admin/settings/feature.spaces_enabled', { value: 'true' });
    out.push('ok settings feature.spaces_enabled=true');
  } catch (e) {
    out.push(`err settings feature.spaces_enabled: ${e.message}`);
  }
  console.log(out.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
