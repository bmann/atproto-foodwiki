// CI helper: verify deploy/happyview/Dockerfile tracks the upstream HappyView
// Dockerfile at the pinned ref (ignoring our leading header comment block).
const REF = process.env.HAPPYVIEW_REF || 'v2.13.0';
const UPSTREAM = `https://raw.githubusercontent.com/gamesgamesgamesgamesgames/happyview/${REF}/Dockerfile`;
const LOCAL = new URL('../deploy/happyview/Dockerfile', import.meta.url);
import { readFile } from 'node:fs/promises';
try {
  const [upRaw, localRaw] = await Promise.all([
    fetch(UPSTREAM).then(r => r.text()),
    readFile(LOCAL, 'utf8'),
  ]);
  // strip leading comment header (# ...) lines from local
  const local = localRaw.split('\n').filter(l => !(l.startsWith('# HappyView AppView') || l.startsWith('# Dockerfile (kept') || l.startsWith('# Railway: New'))).join('\n').trim();
  if (upRaw.trim() !== local) {
    console.error(`Mismatch: deploy/happyview/Dockerfile differs from upstream HappyView Dockerfile @ ${REF}`);
    process.exit(1);
  }
  console.log(`OK: deploy/happyview/Dockerfile matches upstream HappyView Dockerfile @ ${REF}`);
} catch (e) {
  console.error('Could not check upstream:', e.message);
  process.exit(2);
}
