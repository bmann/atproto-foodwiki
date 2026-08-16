// Fetch Bulleted app lexicons from Lexicon Garden and write JSON schema files to ./schemas.
// Uses the site's public XRPC endpoint (com.atproto.lexicon.resolveLexicon).
const BASE = 'https://lexicon.garden/xrpc/com.atproto.lexicon.resolveLexicon?nsid=';
const NSIDS = [
  'app.bulleted.node', 'app.bulleted.note', 'app.bulleted.outline',
  'app.bulleted.mirror', 'app.bulleted.comment', 'app.bulleted.commentPolicy',
  'app.bulleted.getOutline', 'app.bulleted.authFull', 'app.bulleted.appAccess',
  'app.bulleted.admin.deny', 'app.bulleted.admin.listDenied', 'app.bulleted.admin.undeny',
];
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
await mkdir(OUT, { recursive: true });
const results = [];
for (const nsid of NSIDS) {
  try {
    const res = await fetch(`${BASE}${encodeURIComponent(nsid)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json?.schema || json.schema.id !== nsid) throw new Error(`unexpected payload (id=${json?.schema?.id})`);
    const file = path.join(OUT, `${nsid}.json`);
    await writeFile(file, JSON.stringify(json.schema, null, 2) + '\n');
    results.push(`ok   ${nsid}  (${json.schema.revision ?? 'rev?'})  → ${nsid}.json`);
  } catch (e) {
    results.push(`FAIL ${nsid}  ${e.message}`);
  }
}
console.log(results.join('\n'));
