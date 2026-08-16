import { createClient } from './lib/client.js';
import { getOutline } from './lib/outline.js';

// Phase 2 will point this at our HappyView instance. For now, demonstrate reads:
// 1) getOutline against an appview that hosts it (will fail on bsky.social for now)
// 2) direct repo reads from the user's PDS (works anywhere)
const did = 'did:plc:kwclrfytscd4udqzmsv42rj3'; // foodwiki.bmann.ca
const pds = 'https://shimeji.us-east.host.bsky.network';
const appview = 'https://bsky.social'; // temporary

const av = createClient(appview);
try {
  const outline = await getOutline(av, { did, depth: 2 });
  console.log('✅ outline:', JSON.stringify(outline, null, 2).slice(0, 500));
} catch (e) {
  console.log('⏳ getOutline not hosted here yet (expected pre-HappyView):', (e as Error).message);
}

const rpc = createClient(pds);
const res = await rpc.get('com.atproto.repo.listRecords', {
  params: { repo: did, collection: 'app.bsky.actor.profile', limit: 1 },
});
if (res.ok) {
  console.log('✅ direct PDS read works:', res.data.records?.[0]?.value?.displayName);
}
